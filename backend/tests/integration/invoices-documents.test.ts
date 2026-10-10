import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { actor, app, createCaseFor, createClientFor, disconnect, resetDatabase } from '../helpers';

beforeEach(resetDatabase);
afterAll(disconnect);

describe('Invoices', () => {
  async function setup() {
    const lawyer = await actor('LAWYER');
    const client = await createClientFor(lawyer.user.id);
    const caseRecord = await createCaseFor(lawyer.user.id, client.id);
    return { lawyer, client, caseRecord };
  }

  it('calculates totals server-side and ignores client-provided totals', async () => {
    const { lawyer, client, caseRecord } = await setup();
    const response = await request(app)
      .post('/api/invoices')
      .set(lawyer.auth)
      .send({
        clientId: client.id,
        caseId: caseRecord.id,
        taxRate: 20,
        total: 1,
        items: [
          { description: 'Consultation', quantity: 2, unitPrice: 1500 },
          { description: 'Rédaction', quantity: 1, unitPrice: 4000.5 },
        ],
      });
    expect(response.status).toBe(201);
    expect(response.body.data).toMatchObject({
      amount: 7000.5,
      tax: 1400.1,
      total: 8400.6,
      amountPaid: 0,
      balance: 8400.6,
      status: 'DRAFT',
    });
    expect(response.body.data.invoiceNumber).toMatch(/^INV-\d{4}-0001$/);
    expect(response.body.data.items.map((item: { total: number }) => item.total)).toEqual([
      3000, 4000.5,
    ]);
  });

  it('handles partial payment, full payment, overpayment and cancellation rules', async () => {
    const { lawyer, client } = await setup();
    const created = await request(app)
      .post('/api/invoices')
      .set(lawyer.auth)
      .send({
        clientId: client.id,
        taxRate: 0,
        status: 'SENT',
        items: [{ description: 'Fees', quantity: 1, unitPrice: 1000 }],
      });
    const id = created.body.data.id as string;

    const partial = await request(app)
      .post(`/api/invoices/${id}/pay`)
      .set(lawyer.auth)
      .send({ amount: 400 });
    expect(partial.body.data).toMatchObject({
      status: 'PARTIALLY_PAID',
      amountPaid: 400,
      balance: 600,
      paidAt: null,
    });

    const locked = await request(app)
      .put(`/api/invoices/${id}`)
      .set(lawyer.auth)
      .send({ notes: 'x' });
    expect(locked.status).toBe(400);

    const over = await request(app)
      .post(`/api/invoices/${id}/pay`)
      .set(lawyer.auth)
      .send({ amount: 700 });
    expect(over.status).toBe(400);
    expect(over.body.errorCode).toBe('OVERPAYMENT');

    const full = await request(app).post(`/api/invoices/${id}/pay`).set(lawyer.auth).send({});
    expect(full.body.data).toMatchObject({ status: 'PAID', amountPaid: 1000, balance: 0 });
    expect(full.body.data.paidAt).not.toBeNull();

    expect((await request(app).post(`/api/invoices/${id}/cancel`).set(lawyer.auth)).status).toBe(
      400,
    );
  });

  it('recalculates totals on update, filters lists and cancels invoices', async () => {
    const { lawyer, client } = await setup();
    const created = await request(app)
      .post('/api/invoices')
      .set(lawyer.auth)
      .send({
        clientId: client.id,
        taxRate: 10,
        items: [{ description: 'A', quantity: 1, unitPrice: 100 }],
      });
    const id = created.body.data.id as string;

    const updated = await request(app)
      .put(`/api/invoices/${id}`)
      .set(lawyer.auth)
      .send({ items: [{ description: 'B', quantity: 3, unitPrice: 50 }], status: 'SENT' });
    expect(updated.body.data).toMatchObject({ amount: 150, tax: 15, total: 165, status: 'SENT' });

    const list = await request(app).get('/api/invoices?status=SENT').set(lawyer.auth);
    expect(list.body.meta.total).toBe(1);
    const search = await request(app)
      .get(`/api/invoices?search=${created.body.data.invoiceNumber}`)
      .set(lawyer.auth);
    expect(search.body.meta.total).toBe(1);

    const cancelled = await request(app).post(`/api/invoices/${id}/cancel`).set(lawyer.auth);
    expect(cancelled.body.data.status).toBe('CANCELLED');
  });

  it('validates invoice input and returns 404 for unknown invoices', async () => {
    const { lawyer, client } = await setup();
    const noItems = await request(app)
      .post('/api/invoices')
      .set(lawyer.auth)
      .send({ clientId: client.id, items: [] });
    expect(noItems.status).toBe(400);
    const negative = await request(app)
      .post('/api/invoices')
      .set(lawyer.auth)
      .send({ clientId: client.id, items: [{ description: 'x', quantity: -1, unitPrice: 10 }] });
    expect(negative.status).toBe(400);
    expect((await request(app).get(`/api/invoices/${randomUUID()}`).set(lawyer.auth)).status).toBe(
      404,
    );
  });
});

describe('Documents', () => {
  const pdf = Buffer.from('%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF');

  it('uploads, lists, downloads, renames and deletes a document', async () => {
    const lawyer = await actor('LAWYER');
    const client = await createClientFor(lawyer.user.id);
    const caseRecord = await createCaseFor(lawyer.user.id, client.id);

    const uploaded = await request(app)
      .post('/api/documents')
      .set(lawyer.auth)
      .field('caseId', caseRecord.id)
      .field('type', 'EVIDENCE')
      .attach('file', pdf, { filename: 'preuve.pdf', contentType: 'application/pdf' });
    expect(uploaded.status).toBe(201);
    expect(uploaded.body.data).toMatchObject({
      name: 'preuve.pdf',
      type: 'EVIDENCE',
      clientId: client.id,
    });
    expect(uploaded.body.data.fileUrl).toBeUndefined();
    const id = uploaded.body.data.id as string;

    const list = await request(app).get(`/api/documents?caseId=${caseRecord.id}`).set(lawyer.auth);
    expect(list.body.meta.total).toBe(1);

    const download = await request(app).get(`/api/documents/${id}/download`).set(lawyer.auth);
    expect(download.status).toBe(200);
    expect(download.headers['content-type']).toContain('application/pdf');
    expect(download.headers['content-disposition']).toContain('attachment');

    const other = await actor('LAWYER');
    expect((await request(app).get(`/api/documents/${id}/download`).set(other.auth)).status).toBe(
      403,
    );

    const renamed = await request(app)
      .patch(`/api/documents/${id}`)
      .set(lawyer.auth)
      .send({ name: 'Pièce 1.pdf', type: 'COURT_DOCUMENT' });
    expect(renamed.body.data).toMatchObject({ name: 'Pièce 1.pdf', type: 'COURT_DOCUMENT' });

    expect((await request(app).delete(`/api/documents/${id}`).set(lawyer.auth)).status).toBe(204);
  });

  it('rejects disallowed types and spoofed content', async () => {
    const lawyer = await actor('LAWYER');
    const client = await createClientFor(lawyer.user.id);

    const exe = await request(app)
      .post('/api/documents')
      .set(lawyer.auth)
      .field('clientId', client.id)
      .attach('file', Buffer.from('MZ...'), {
        filename: 'virus.exe',
        contentType: 'application/octet-stream',
      });
    expect(exe.status).toBe(400);
    expect(exe.body.errorCode).toBe('INVALID_FILE_TYPE');

    const spoofed = await request(app)
      .post('/api/documents')
      .set(lawyer.auth)
      .field('clientId', client.id)
      .attach('file', Buffer.from('<script>alert(1)</script>'), {
        filename: 'fake.pdf',
        contentType: 'application/pdf',
      });
    expect(spoofed.status).toBe(400);
    expect(spoofed.body.errorCode).toBe('INVALID_FILE_CONTENT');

    const tooBig = await request(app)
      .post('/api/documents')
      .set(lawyer.auth)
      .field('clientId', client.id)
      .attach('file', Buffer.concat([pdf, Buffer.alloc(1024 * 1024 + 10)]), {
        filename: 'big.pdf',
        contentType: 'application/pdf',
      });
    expect(tooBig.status).toBe(413);

    const unlinked = await request(app)
      .post('/api/documents')
      .set(lawyer.auth)
      .attach('file', pdf, { filename: 'a.pdf', contentType: 'application/pdf' });
    expect(unlinked.status).toBe(400);
  });
});

describe('Dashboard & reports', () => {
  it('returns scoped statistics', async () => {
    const lawyer = await actor('LAWYER');
    const client = await createClientFor(lawyer.user.id);
    await createCaseFor(lawyer.user.id, client.id);
    const stats = await request(app).get('/api/dashboard/stats').set(lawyer.auth);
    expect(stats.status).toBe(200);
    expect(stats.body.data.totals).toMatchObject({ clients: 1, activeCases: 1 });
    expect(stats.body.data.finance.monthly).toHaveLength(6);

    const assistant = await actor('ASSISTANT');
    const assistantStats = await request(app).get('/api/dashboard/stats').set(assistant.auth);
    expect(assistantStats.body.data.totals.clients).toBe(0);
    expect(assistantStats.body.data.finance).toBeNull();

    const reports = await request(app).get('/api/reports').set(lawyer.auth);
    expect(reports.status).toBe(200);
    expect(reports.body.data.cases.byStatus).toEqual([{ status: 'OPEN', count: 1 }]);
  });
});
