import request from 'supertest';
import { prisma } from '../../src/config/prisma';
import { processHearingReminders, runReminderJob } from '../../src/services/reminder.service';
import { actor, app, createCaseFor, createClientFor, disconnect, resetDatabase } from '../helpers';

beforeEach(resetDatabase);
afterAll(disconnect);

const DAY = 86_400_000;

async function setup() {
  const lawyer = await actor('LAWYER');
  const assistant = await actor('ASSISTANT');
  const client = await createClientFor(lawyer.user.id);
  const caseRecord = await createCaseFor(lawyer.user.id, client.id, [assistant.user.id]);
  return { lawyer, assistant, caseRecord };
}

describe('Hearings', () => {
  it('creates, lists by range, updates, completes and deletes hearings', async () => {
    const { lawyer, caseRecord } = await setup();
    const later = new Date(Date.now() + 20 * DAY);
    const created = await request(app).post('/api/hearings').set(lawyer.auth).send({
      caseId: caseRecord.id,
      date: later.toISOString(),
      time: '10:00',
      type: 'PLEADING',
      location: 'Salle 3',
    });
    expect(created.status).toBe(201);
    expect(created.body.data.court).toBe('Tribunal de Commerce');
    const id = created.body.data.id as string;

    await prisma.hearing.create({
      data: { caseId: caseRecord.id, date: new Date(Date.now() - 3 * DAY), time: '09:00' },
    });

    const upcoming = await request(app).get('/api/hearings?range=upcoming').set(lawyer.auth);
    expect(upcoming.body.data.map((h: { id: string }) => h.id)).toEqual([id]);
    const overdue = await request(app).get('/api/hearings?range=overdue').set(lawyer.auth);
    expect(overdue.body.meta.total).toBe(1);

    const bad = await request(app)
      .put(`/api/hearings/${id}`)
      .set(lawyer.auth)
      .send({ time: '25:99' });
    expect(bad.status).toBe(400);

    const completed = await request(app)
      .post(`/api/hearings/${id}/complete`)
      .set(lawyer.auth)
      .send({ notes: 'Renvoi' });
    expect(completed.body.data).toMatchObject({ status: 'COMPLETED', notes: 'Renvoi' });

    expect((await request(app).delete(`/api/hearings/${id}`).set(lawyer.auth)).status).toBe(204);
    expect((await request(app).get(`/api/hearings/${id}`).set(lawyer.auth)).status).toBe(404);
  });

  it('refuses hearings on closed cases', async () => {
    const { lawyer, caseRecord } = await setup();
    await prisma.case.update({ where: { id: caseRecord.id }, data: { status: 'CLOSED' } });
    const response = await request(app)
      .post('/api/hearings')
      .set(lawyer.auth)
      .send({
        caseId: caseRecord.id,
        date: new Date(Date.now() + DAY).toISOString(),
        time: '10:00',
      });
    expect(response.status).toBe(400);
    expect(response.body.errorCode).toBe('CASE_CLOSED');
  });
});

describe('Hearing reminders', () => {
  it('sends one reminder per stage and recipient and never duplicates', async () => {
    const { lawyer, assistant, caseRecord } = await setup();
    const now = new Date();
    const inThreeDays = new Date(now.getTime() + 3 * DAY);
    const hearing = await prisma.hearing.create({
      data: { caseId: caseRecord.id, date: inThreeDays, time: '10:00' },
    });

    const first = await processHearingReminders(now);
    expect(first).toBe(2); // lawyer + assistant
    const second = await processHearingReminders(now);
    expect(second).toBe(0);
    await Promise.all([processHearingReminders(now), processHearingReminders(now)]);

    const reminders = await prisma.notification.findMany({
      where: { type: 'HEARING_REMINDER', relatedEntityId: hearing.id },
    });
    expect(reminders).toHaveLength(2);
    expect(reminders.map((r) => r.userId).sort()).toEqual(
      [lawyer.user.id, assistant.user.id].sort(),
    );
    expect(reminders[0].data).toMatchObject({ stage: '3d', daysUntil: 3 });

    // Two days later the "1 day" stage applies: new reminders, still no duplicates.
    const oneDayBefore = new Date(inThreeDays.getTime() - DAY);
    expect(await processHearingReminders(oneDayBefore)).toBe(2);
    expect(await processHearingReminders(oneDayBefore)).toBe(0);

    // Same day: final reminder, then the hearing is flagged.
    expect(await processHearingReminders(inThreeDays)).toBe(2);
    const updated = await prisma.hearing.findUniqueOrThrow({ where: { id: hearing.id } });
    expect(updated.reminderSent).toBe(true);
    expect(await prisma.notification.count({ where: { relatedEntityId: hearing.id } })).toBe(6);
  });

  it('sends the applicable reminder immediately when a hearing is created via the API', async () => {
    const { lawyer, assistant, caseRecord } = await setup();
    await request(app)
      .post('/api/hearings')
      .set(assistant.auth)
      .send({
        caseId: caseRecord.id,
        date: new Date(Date.now() + DAY + 3_600_000).toISOString(),
        time: '11:00',
      });
    const lawyerNotifications = await prisma.notification.findMany({
      where: { userId: lawyer.user.id, type: 'HEARING_REMINDER' },
    });
    expect(lawyerNotifications).toHaveLength(1);
  });

  it('ignores hearings beyond 7 days and completed hearings', async () => {
    const { caseRecord } = await setup();
    await prisma.hearing.createMany({
      data: [
        { caseId: caseRecord.id, date: new Date(Date.now() + 9 * DAY), time: '10:00' },
        {
          caseId: caseRecord.id,
          date: new Date(Date.now() + DAY),
          time: '10:00',
          status: 'COMPLETED',
        },
      ],
    });
    expect(await processHearingReminders()).toBe(0);
  });

  it('marks overdue invoices and warns once through the full job', async () => {
    const { lawyer, caseRecord } = await setup();
    await prisma.invoice.create({
      data: {
        invoiceNumber: 'INV-TEST-1',
        clientId: caseRecord.clientId,
        createdById: lawyer.user.id,
        amount: 100,
        tax: 20,
        total: 120,
        status: 'SENT',
        dueDate: new Date(Date.now() - 2 * DAY),
      },
    });
    const first = await runReminderJob();
    expect(first.invoicesOverdue).toBe(1);
    expect(first.invoiceAlerts).toBe(1);
    const second = await runReminderJob();
    expect(second.invoiceAlerts).toBe(0);
  });
});

describe('Notifications API', () => {
  it('lists, counts and marks notifications as read for the owner only', async () => {
    const { lawyer, assistant } = await setup();
    await prisma.notification.createMany({
      data: [
        { userId: lawyer.user.id, type: 'CASE_UPDATED', title: 'A', message: 'a' },
        { userId: lawyer.user.id, type: 'INVOICE_DUE', title: 'B', message: 'b' },
      ],
    });
    const list = await request(app).get('/api/notifications').set(lawyer.auth);
    expect(list.body.meta.unreadCount).toBe(2);
    expect(list.body.data[0].dedupeKey).toBeUndefined();
    const id = list.body.data[0].id as string;

    expect(
      (await request(app).patch(`/api/notifications/${id}/read`).set(assistant.auth)).status,
    ).toBe(404);

    const read = await request(app).patch(`/api/notifications/${id}/read`).set(lawyer.auth);
    expect(read.body.data.isRead).toBe(true);
    expect(
      (await request(app).get('/api/notifications/unread-count').set(lawyer.auth)).body.data.count,
    ).toBe(1);

    const all = await request(app).patch('/api/notifications/read-all').set(lawyer.auth);
    expect(all.body.data.updated).toBe(1);
    const unreadOnly = await request(app)
      .get('/api/notifications?unreadOnly=true')
      .set(lawyer.auth);
    expect(unreadOnly.body.meta.total).toBe(0);
  });
});
