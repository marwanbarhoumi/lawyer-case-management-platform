import request from 'supertest';
import { actor, app, createCaseFor, createClientFor, disconnect, resetDatabase } from '../helpers';

beforeEach(resetDatabase);
afterAll(disconnect);

describe('Authorization (RBAC + row-level access)', () => {
  it("prevents a lawyer from reading another lawyer's private case", async () => {
    const owner = await actor('LAWYER');
    const other = await actor('LAWYER');
    const client = await createClientFor(owner.user.id);
    const privateCase = await createCaseFor(owner.user.id, client.id);

    const forbidden = await request(app).get(`/api/cases/${privateCase.id}`).set(other.auth);
    expect(forbidden.status).toBe(403);
    expect(forbidden.body.errorCode).toBe('CASE_FORBIDDEN');

    const list = await request(app).get('/api/cases').set(other.auth);
    expect(list.body.meta.total).toBe(0);

    const update = await request(app)
      .put(`/api/cases/${privateCase.id}`)
      .set(other.auth)
      .send({ title: 'Hijack' });
    expect(update.status).toBe(403);

    const hearing = await request(app)
      .post('/api/hearings')
      .set(other.auth)
      .send({
        caseId: privateCase.id,
        date: new Date(Date.now() + 86_400_000).toISOString(),
        time: '10:00',
      });
    expect(hearing.status).toBe(403);

    expect((await request(app).get(`/api/cases/${privateCase.id}`).set(owner.auth)).status).toBe(
      200,
    );
  });

  it('lets a lawyer access a case once assigned to it', async () => {
    const owner = await actor('LAWYER');
    const colleague = await actor('LAWYER');
    const client = await createClientFor(owner.user.id);
    const sharedCase = await createCaseFor(owner.user.id, client.id, [colleague.user.id]);
    expect((await request(app).get(`/api/cases/${sharedCase.id}`).set(colleague.auth)).status).toBe(
      200,
    );
    // ...but only the lead lawyer may modify the case itself.
    expect(
      (
        await request(app)
          .put(`/api/cases/${sharedCase.id}`)
          .set(colleague.auth)
          .send({ title: 'x' })
      ).status,
    ).toBe(403);
  });

  it('limits assistants to assigned cases and read-only clients', async () => {
    const lawyer = await actor('LAWYER');
    const assistant = await actor('ASSISTANT');
    const client = await createClientFor(lawyer.user.id);
    const assigned = await createCaseFor(lawyer.user.id, client.id, [assistant.user.id]);
    const notAssigned = await createCaseFor(lawyer.user.id, client.id);

    const list = await request(app).get('/api/cases').set(assistant.auth);
    expect(list.body.data.map((item: { id: string }) => item.id)).toEqual([assigned.id]);
    expect(
      (await request(app).get(`/api/cases/${notAssigned.id}`).set(assistant.auth)).status,
    ).toBe(403);

    expect((await request(app).get(`/api/clients/${client.id}`).set(assistant.auth)).status).toBe(
      200,
    );
    expect(
      (
        await request(app)
          .post('/api/clients')
          .set(assistant.auth)
          .send({ firstName: 'A', lastName: 'B' })
      ).status,
    ).toBe(403);
    expect(
      (
        await request(app)
          .post('/api/cases')
          .set(assistant.auth)
          .send({ title: 'x', clientId: client.id })
      ).status,
    ).toBe(403);
    expect((await request(app).get('/api/invoices').set(assistant.auth)).status).toBe(403);
    expect((await request(app).get('/api/contracts').set(assistant.auth)).status).toBe(403);
    expect((await request(app).get('/api/reports').set(assistant.auth)).status).toBe(403);

    // Assistants manage hearings on assigned cases.
    const hearing = await request(app)
      .post('/api/hearings')
      .set(assistant.auth)
      .send({
        caseId: assigned.id,
        date: new Date(Date.now() + 10 * 86_400_000).toISOString(),
        time: '09:30',
      });
    expect(hearing.status).toBe(201);
  });

  it('restricts administration endpoints to admins', async () => {
    const lawyer = await actor('LAWYER');
    const admin = await actor('ADMIN');
    expect((await request(app).get('/api/users').set(lawyer.auth)).status).toBe(403);
    expect(
      (await request(app).put('/api/settings').set(lawyer.auth).send({ firmName: 'X' })).status,
    ).toBe(403);
    expect((await request(app).get('/api/users').set(admin.auth)).status).toBe(200);
    expect(
      (await request(app).put('/api/settings').set(admin.auth).send({ firmName: 'Cabinet X' }))
        .status,
    ).toBe(200);
  });

  it('lets admins see every case and manage users', async () => {
    const lawyer = await actor('LAWYER');
    const admin = await actor('ADMIN');
    const client = await createClientFor(lawyer.user.id);
    await createCaseFor(lawyer.user.id, client.id);
    const list = await request(app).get('/api/cases').set(admin.auth);
    expect(list.body.meta.total).toBe(1);

    const created = await request(app).post('/api/users').set(admin.auth).send({
      firstName: 'New',
      lastName: 'Assistant',
      email: 'new.assistant@test.local',
      password: 'Assist123',
      role: 'ASSISTANT',
    });
    expect(created.status).toBe(201);
    expect(created.body.data.passwordHash).toBeUndefined();

    const deactivated = await request(app)
      .put(`/api/users/${created.body.data.id}`)
      .set(admin.auth)
      .send({ isActive: false });
    expect(deactivated.body.data.isActive).toBe(false);

    const selfLock = await request(app)
      .put(`/api/users/${admin.user.id}`)
      .set(admin.auth)
      .send({ isActive: false });
    expect(selfLock.status).toBe(400);
  });
});
