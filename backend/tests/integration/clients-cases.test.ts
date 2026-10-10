import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { actor, app, disconnect, resetDatabase } from '../helpers';

beforeEach(resetDatabase);
afterAll(disconnect);

describe('Clients CRUD', () => {
  it('creates, reads, searches, updates, archives and restores clients', async () => {
    const lawyer = await actor('LAWYER');
    const created = await request(app).post('/api/clients').set(lawyer.auth).send({
      firstName: 'Ahmed',
      lastName: 'El Mansouri',
      email: 'AHMED@example.com',
      phone: '+212 612345678',
    });
    expect(created.status).toBe(201);
    expect(created.body.data).toMatchObject({
      email: 'ahmed@example.com',
      lawyerId: lawyer.user.id,
    });
    const id = created.body.data.id as string;

    await request(app)
      .post('/api/clients')
      .set(lawyer.auth)
      .send({ firstName: 'Claire', lastName: 'Martin' });

    const search = await request(app).get('/api/clients?search=ahmed mans').set(lawyer.auth);
    expect(search.body.meta.total).toBe(1);
    const byPhone = await request(app).get('/api/clients?search=612345').set(lawyer.auth);
    expect(byPhone.body.data[0].id).toBe(id);

    const paged = await request(app)
      .get('/api/clients?page=2&pageSize=1&sortBy=lastName&sortOrder=asc')
      .set(lawyer.auth);
    expect(paged.body.meta).toMatchObject({ page: 2, pageSize: 1, total: 2, totalPages: 2 });
    expect(paged.body.data[0].lastName).toBe('Martin');

    const profile = await request(app).get(`/api/clients/${id}`).set(lawyer.auth);
    expect(profile.status).toBe(200);
    expect(profile.body.data.summary).toMatchObject({ activeCases: 0, totalInvoiced: 0 });

    const updated = await request(app)
      .put(`/api/clients/${id}`)
      .set(lawyer.auth)
      .send({ address: 'Casablanca' });
    expect(updated.body.data).toMatchObject({ address: 'Casablanca', firstName: 'Ahmed' });

    const archived = await request(app).delete(`/api/clients/${id}`).set(lawyer.auth);
    expect(archived.body.data.isArchived).toBe(true);
    expect((await request(app).get('/api/clients').set(lawyer.auth)).body.meta.total).toBe(1);
    expect(
      (await request(app).get('/api/clients?archived=true').set(lawyer.auth)).body.meta.total,
    ).toBe(1);

    const restored = await request(app).post(`/api/clients/${id}/restore`).set(lawyer.auth);
    expect(restored.body.data.isArchived).toBe(false);

    const timeline = await request(app).get(`/api/clients/${id}/timeline`).set(lawyer.auth);
    expect(timeline.body.data.map((entry: { action: string }) => entry.action)).toEqual(
      expect.arrayContaining([
        'client.created',
        'client.updated',
        'client.archived',
        'client.restored',
      ]),
    );
  });

  it('returns 400 for invalid input and 404 for unknown clients', async () => {
    const lawyer = await actor('LAWYER');
    expect(
      (await request(app).post('/api/clients').set(lawyer.auth).send({ firstName: '' })).status,
    ).toBe(400);
    expect((await request(app).get('/api/clients/not-a-uuid').set(lawyer.auth)).status).toBe(400);
    const missing = await request(app).get(`/api/clients/${randomUUID()}`).set(lawyer.auth);
    expect(missing.status).toBe(404);
    expect(missing.body).toEqual({
      success: false,
      message: 'Client not found',
      errorCode: 'CLIENT_NOT_FOUND',
    });
  });
});

describe('Cases CRUD', () => {
  async function setup() {
    const lawyer = await actor('LAWYER');
    const client = await request(app)
      .post('/api/clients')
      .set(lawyer.auth)
      .send({ firstName: 'Fatima', lastName: 'Alaoui' });
    return { lawyer, clientId: client.body.data.id as string };
  }

  it('creates a case with an automatic reference and manages its lifecycle', async () => {
    const { lawyer, clientId } = await setup();
    const assistant = await actor('ASSISTANT');
    const created = await request(app)
      .post('/api/cases')
      .set(lawyer.auth)
      .send({
        title: 'Litige commercial',
        clientId,
        caseType: 'COMMERCIAL',
        priority: 'URGENT',
        court: 'Tribunal de Commerce',
        opposingParty: 'Maghreb SA',
        assistantIds: [assistant.user.id],
      });
    expect(created.status).toBe(201);
    expect(created.body.data.referenceNumber).toMatch(/^CASE-\d{4}-0001$/);
    expect(created.body.data.lawyer.id).toBe(lawyer.user.id);
    expect(created.body.data.assistants).toHaveLength(1);
    const id = created.body.data.id as string;

    const second = await request(app)
      .post('/api/cases')
      .set(lawyer.auth)
      .send({ title: 'Other', clientId });
    expect(second.body.data.referenceNumber).toMatch(/-0002$/);

    const filtered = await request(app)
      .get('/api/cases?priority=URGENT&status=OPEN')
      .set(lawyer.auth);
    expect(filtered.body.meta.total).toBe(1);
    const searched = await request(app).get('/api/cases?search=maghreb').set(lawyer.auth);
    expect(searched.body.data[0].id).toBe(id);

    const closed = await request(app).post(`/api/cases/${id}/close`).set(lawyer.auth);
    expect(closed.body.data.status).toBe('CLOSED');
    expect(closed.body.data.closingDate).not.toBeNull();

    const reopened = await request(app).post(`/api/cases/${id}/reopen`).set(lawyer.auth);
    expect(reopened.body.data).toMatchObject({ status: 'IN_PROGRESS', closingDate: null });

    const timeline = await request(app).get(`/api/cases/${id}/timeline`).set(lawyer.auth);
    expect(timeline.body.data.length).toBeGreaterThanOrEqual(3);

    // The assistant was notified about the new assignment.
    const notifications = await request(app).get('/api/notifications').set(assistant.auth);
    expect(notifications.body.data.some((n: { type: string }) => n.type === 'CASE_UPDATED')).toBe(
      true,
    );

    expect((await request(app).delete(`/api/cases/${id}`).set(lawyer.auth)).status).toBe(204);
    expect((await request(app).get(`/api/cases/${id}`).set(lawyer.auth)).status).toBe(404);
  });

  it('validates case input', async () => {
    const { lawyer } = await setup();
    const invalid = await request(app)
      .post('/api/cases')
      .set(lawyer.auth)
      .send({ title: 'x', clientId: 'bad', priority: 'NOPE' });
    expect(invalid.status).toBe(400);
    const missingClient = await request(app)
      .post('/api/cases')
      .set(lawyer.auth)
      .send({ title: 'x', clientId: randomUUID() });
    expect(missingClient.status).toBe(404);
  });
});
