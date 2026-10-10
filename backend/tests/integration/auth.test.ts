import request from 'supertest';
import { prisma } from '../../src/config/prisma';
import { sha256 } from '../../src/utils/crypto';
import { app, createUser, disconnect, login, PASSWORD, resetDatabase } from '../helpers';

beforeEach(resetDatabase);
afterAll(disconnect);

const refreshCookie = (cookies: string[] | undefined) =>
  (cookies ?? []).find((cookie) => cookie.startsWith('lm_refresh='))?.split(';')[0];

describe('Authentication', () => {
  it('registers a lawyer, never exposing the password hash', async () => {
    const response = await request(app).post('/api/auth/register').send({
      firstName: 'Nadia',
      lastName: 'Lahlou',
      email: 'Nadia@Example.com',
      password: 'Secret123',
    });
    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    expect(response.body.data.user).toMatchObject({ email: 'nadia@example.com', role: 'LAWYER' });
    expect(response.body.data.user.passwordHash).toBeUndefined();
    expect(response.body.data.accessToken).toEqual(expect.any(String));
    expect(refreshCookie(response.headers['set-cookie'] as unknown as string[])).toBeDefined();
  });

  it('rejects invalid registration input with 400', async () => {
    const response = await request(app)
      .post('/api/auth/register')
      .send({ firstName: '', lastName: 'X', email: 'not-an-email', password: 'short' });
    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({ success: false, errorCode: 'VALIDATION_ERROR' });
  });

  it('refuses duplicate emails with 409', async () => {
    const user = await createUser('LAWYER');
    const response = await request(app)
      .post('/api/auth/register')
      .send({ firstName: 'A', lastName: 'B', email: user.email, password: 'Secret123' });
    expect(response.status).toBe(409);
  });

  it('logs in with valid credentials and rejects bad ones with 401', async () => {
    const user = await createUser('LAWYER');
    const ok = await request(app)
      .post('/api/auth/login')
      .send({ email: user.email, password: PASSWORD });
    expect(ok.status).toBe(200);
    const bad = await request(app)
      .post('/api/auth/login')
      .send({ email: user.email, password: 'Wrong1234' });
    expect(bad.status).toBe(401);
    expect(bad.body.errorCode).toBe('INVALID_CREDENTIALS');
  });

  it('blocks deactivated accounts', async () => {
    const user = await createUser('LAWYER', { isActive: false });
    const response = await request(app)
      .post('/api/auth/login')
      .send({ email: user.email, password: PASSWORD });
    expect(response.status).toBe(403);
  });

  it('requires a valid token for protected routes', async () => {
    expect((await request(app).get('/api/auth/me')).status).toBe(401);
    expect(
      (await request(app).get('/api/auth/me').set('Authorization', 'Bearer invalid')).status,
    ).toBe(401);

    const user = await createUser('ASSISTANT');
    const { token } = await login(user.email);
    const me = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`);
    expect(me.status).toBe(200);
    expect(me.body.data).toMatchObject({ id: user.id, role: 'ASSISTANT' });
    expect(me.body.data.passwordHash).toBeUndefined();
  });

  it('rotates refresh tokens and revokes the session when an old token is reused', async () => {
    const user = await createUser('LAWYER');
    const { cookie } = await login(user.email);
    const first = refreshCookie(cookie) as string;

    const refreshed = await request(app).post('/api/auth/refresh').set('Cookie', first);
    expect(refreshed.status).toBe(200);
    const second = refreshCookie(refreshed.headers['set-cookie'] as unknown as string[]) as string;
    expect(second).not.toEqual(first);

    // Reuse after the concurrency grace period is treated as theft.
    const realNow = Date.now();
    const clock = jest.spyOn(Date, 'now').mockReturnValue(realNow + 31_000);
    try {
      const reuse = await request(app).post('/api/auth/refresh').set('Cookie', first);
      expect(reuse.status).toBe(401);
      expect(reuse.body.errorCode).toBe('REFRESH_TOKEN_REUSED');
    } finally {
      clock.mockRestore();
    }

    // The whole session is now revoked, including the latest token.
    expect((await request(app).post('/api/auth/refresh').set('Cookie', second)).status).toBe(401);
  });

  it('gives concurrent refreshes with the same token the same new token', async () => {
    const user = await createUser('LAWYER');
    const { cookie } = await login(user.email);
    const first = refreshCookie(cookie) as string;

    const [a, b] = await Promise.all([
      request(app).post('/api/auth/refresh').set('Cookie', first),
      request(app).post('/api/auth/refresh').set('Cookie', first),
    ]);
    expect([a.status, b.status]).toEqual([200, 200]);
    const tokenA = refreshCookie(a.headers['set-cookie'] as unknown as string[]);
    expect(tokenA).toBeDefined();
    expect(refreshCookie(b.headers['set-cookie'] as unknown as string[])).toEqual(tokenA);

    // A reload that resends the old cookie shortly afterwards still gets the current token.
    const late = await request(app).post('/api/auth/refresh').set('Cookie', first);
    expect(late.status).toBe(200);
    expect(refreshCookie(late.headers['set-cookie'] as unknown as string[])).toEqual(tokenA);
    expect(
      (
        await request(app)
          .post('/api/auth/refresh')
          .set('Cookie', tokenA as string)
      ).status,
    ).toBe(200);
  });

  it('logs out and invalidates the access token session', async () => {
    const user = await createUser('LAWYER');
    const { token, cookie } = await login(user.email);
    const auth = { Authorization: `Bearer ${token}` };
    const logout = await request(app).post('/api/auth/logout').set(auth);
    expect(logout.status).toBe(200);
    const cleared = (logout.headers['set-cookie'] as unknown as string[]).find((value) =>
      value.startsWith('lm_refresh='),
    );
    expect(cleared).toMatch(/^lm_refresh=;/);
    expect(cleared).toContain('Path=/api/auth');
    expect(cleared).toContain('Expires=Thu, 01 Jan 1970');

    const me = await request(app).get('/api/auth/me').set(auth);
    expect(me.status).toBe(401);
    expect(me.body.errorCode).toBe('SESSION_REVOKED');
    const refresh = await request(app)
      .post('/api/auth/refresh')
      .set('Cookie', refreshCookie(cookie) as string);
    expect(refresh.status).toBe(401);
  });

  it('updates profile and password', async () => {
    const user = await createUser('LAWYER');
    const { token } = await login(user.email);
    const auth = { Authorization: `Bearer ${token}` };

    const profile = await request(app)
      .put('/api/auth/profile')
      .set(auth)
      .send({ firstName: 'Updated', lastName: 'Name', phone: '+212 600000000' });
    expect(profile.status).toBe(200);
    expect(profile.body.data.firstName).toBe('Updated');

    const wrong = await request(app)
      .put('/api/auth/password')
      .set(auth)
      .send({ currentPassword: 'Nope12345', newPassword: 'NewPass123' });
    expect(wrong.status).toBe(400);

    const ok = await request(app)
      .put('/api/auth/password')
      .set(auth)
      .send({ currentPassword: PASSWORD, newPassword: 'NewPass123' });
    expect(ok.status).toBe(200);
    expect(
      (
        await request(app)
          .post('/api/auth/login')
          .send({ email: user.email, password: 'NewPass123' })
      ).status,
    ).toBe(200);
  });

  it('supports the forgot / reset password flow without revealing accounts', async () => {
    const user = await createUser('LAWYER');
    const unknown = await request(app)
      .post('/api/auth/forgot-password')
      .send({ email: 'nobody@test.local' });
    expect(unknown.status).toBe(200);
    const known = await request(app).post('/api/auth/forgot-password').send({ email: user.email });
    expect(known.status).toBe(200);
    expect(await prisma.passwordResetToken.count({ where: { userId: user.id } })).toBe(1);

    const token = 'a'.repeat(64);
    await prisma.passwordResetToken.create({
      data: { userId: user.id, tokenHash: sha256(token), expiresAt: new Date(Date.now() + 60_000) },
    });
    const reset = await request(app)
      .post('/api/auth/reset-password')
      .send({ token, password: 'Reset1234' });
    expect(reset.status).toBe(200);
    const reused = await request(app)
      .post('/api/auth/reset-password')
      .send({ token, password: 'Reset5678' });
    expect(reused.status).toBe(400);
    expect(
      (
        await request(app)
          .post('/api/auth/login')
          .send({ email: user.email, password: 'Reset1234' })
      ).status,
    ).toBe(200);
  });

  it('exposes a health endpoint', async () => {
    const response = await request(app).get('/health');
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: 'ok' });
  });

  it('returns a consistent 404 for unknown routes', async () => {
    const response = await request(app).get('/api/does-not-exist');
    expect(response.status).toBe(404);
    expect(response.body).toMatchObject({ success: false, errorCode: 'ROUTE_NOT_FOUND' });
  });
});
