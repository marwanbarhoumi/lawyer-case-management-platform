/**
 * Development seed. Wipes the domain tables and inserts demo data.
 * Refuses to run in production unless SEED_FORCE=true.
 */
import { randomUUID } from 'node:crypto';
import {
  PrismaClient,
  type CasePriority,
  type CaseStatus,
  type CaseType,
  type DocumentType,
  type HearingType,
  type InvoiceStatus,
} from '@prisma/client';
import { hashPassword } from '../src/utils/crypto';
import { calculateInvoiceTotals } from '../src/utils/invoice-calc';
import { storage } from '../src/storage';
import { runReminderJob } from '../src/services/reminder.service';

const prisma = new PrismaClient();
const DEMO_PASSWORD = process.env.SEED_PASSWORD || 'Demo@2026';
const DAY = 24 * 60 * 60 * 1000;

function at(daysFromNow: number, hour = 9, minute = 0): Date {
  const date = new Date(Date.now() + daysFromNow * DAY);
  date.setHours(hour, minute, 0, 0);
  return date;
}

const hhmm = (date: Date) =>
  `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;

function minimalPdf(text: string): Buffer {
  const stream = `BT /F1 18 Tf 72 720 Td (${text.replace(/[()\\]/g, '')}) Tj ET`;
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ];
  let body = '%PDF-1.4\n';
  const offsets: number[] = [];
  objects.forEach((object, index) => {
    offsets.push(Buffer.byteLength(body));
    body += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xref = Buffer.byteLength(body);
  body += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  body += offsets.map((offset) => `${String(offset).padStart(10, '0')} 00000 n \n`).join('');
  body += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(body);
}

async function wipe() {
  await prisma.$transaction([
    prisma.notification.deleteMany(),
    prisma.activityLog.deleteMany(),
    prisma.invoiceItem.deleteMany(),
    prisma.invoice.deleteMany(),
    prisma.contract.deleteMany(),
    prisma.document.deleteMany(),
    prisma.hearing.deleteMany(),
    prisma.caseAssignment.deleteMany(),
    prisma.case.deleteMany(),
    prisma.client.deleteMany(),
    prisma.passwordResetToken.deleteMany(),
    prisma.userSession.deleteMany(),
    prisma.user.deleteMany(),
    prisma.systemSettings.deleteMany(),
  ]);
}

async function main() {
  if (process.env.NODE_ENV === 'production' && process.env.SEED_FORCE !== 'true') {
    throw new Error('Refusing to seed a production database (set SEED_FORCE=true to override).');
  }
  console.log('Seeding database...');
  await wipe();

  await prisma.systemSettings.create({
    data: {
      id: 'default',
      firmName: 'Cabinet Benali & Associés',
      firmEmail: 'contact@cabinet-benali.ma',
      firmPhone: '+212 5 22 45 67 89',
      firmAddress: '45 Boulevard Zerktouni, Casablanca',
      taxIdentifier: 'IF 12345678',
      currency: 'MAD',
      defaultTaxRate: 20,
    },
  });

  const passwordHash = await hashPassword(DEMO_PASSWORD);
  const user = (
    email: string,
    firstName: string,
    lastName: string,
    role: 'ADMIN' | 'LAWYER' | 'ASSISTANT',
    phone: string,
  ) => prisma.user.create({ data: { email, firstName, lastName, role, phone, passwordHash } });

  const admin = await user('admin@example.com', 'Salma', 'Idrissi', 'ADMIN', '+212 6 61 00 00 01');
  const lawyer = await user(
    'lawyer@example.com',
    'Karim',
    'Benali',
    'LAWYER',
    '+212 6 61 00 00 02',
  );
  const lawyer2 = await user(
    'lawyer2@example.com',
    'Claire',
    'Martin',
    'LAWYER',
    '+212 6 61 00 00 03',
  );
  const assistant = await user(
    'assistant@example.com',
    'Youssef',
    'Amrani',
    'ASSISTANT',
    '+212 6 61 00 00 04',
  );

  const clientsData = [
    {
      firstName: 'Ahmed',
      lastName: 'El Mansouri',
      email: 'ahmed.elmansouri@example.com',
      phone: '+212 6 12 34 56 78',
      address: '12 Rue Ibn Battouta, Casablanca',
      nationalId: 'BE123456',
      lawyerId: lawyer.id,
    },
    {
      firstName: 'Fatima Zahra',
      lastName: 'Alaoui',
      email: 'fz.alaoui@example.com',
      phone: '+212 6 23 45 67 89',
      address: '8 Avenue Mohammed V, Rabat',
      nationalId: 'A987654',
      lawyerId: lawyer.id,
    },
    {
      firstName: 'Société',
      lastName: 'Atlas Négoce SARL',
      email: 'direction@atlas-negoce.ma',
      phone: '+212 5 22 11 22 33',
      address: 'Zone Industrielle Sidi Maârouf, Casablanca',
      nationalId: 'RC 334455',
      lawyerId: lawyer.id,
    },
    {
      firstName: 'Jean',
      lastName: 'Dupont',
      email: 'jean.dupont@example.fr',
      phone: '+33 6 12 34 56 78',
      address: '3 Rue de la Liberté, Tanger',
      nationalId: 'FR778899',
      lawyerId: lawyer.id,
    },
    {
      firstName: 'Khadija',
      lastName: 'Bennani',
      email: 'k.bennani@example.com',
      phone: '+212 6 34 56 78 90',
      address: '21 Derb Sultan, Fès',
      nationalId: 'C445566',
      lawyerId: lawyer.id,
    },
    {
      firstName: 'Omar',
      lastName: 'Tazi',
      email: 'omar.tazi@example.com',
      phone: '+212 6 45 67 89 01',
      address: '5 Rue de Marrakech, Agadir',
      nationalId: 'J112233',
      lawyerId: lawyer2.id,
    },
    {
      firstName: 'Sophie',
      lastName: 'Laurent',
      email: 'sophie.laurent@example.fr',
      phone: '+33 7 98 76 54 32',
      address: '17 Boulevard Pasteur, Tanger',
      nationalId: 'FR445566',
      lawyerId: lawyer2.id,
    },
    {
      firstName: 'Mehdi',
      lastName: 'Chraibi',
      email: 'mehdi.chraibi@example.com',
      phone: '+212 6 56 78 90 12',
      address: '40 Avenue Hassan II, Marrakech',
      nationalId: 'E667788',
      lawyerId: lawyer.id,
    },
  ];
  const clients = [];
  for (const data of clientsData) clients.push(await prisma.client.create({ data }));

  type CaseSeed = {
    title: string;
    type: CaseType;
    status: CaseStatus;
    priority: CasePriority;
    client: number;
    lawyerId: string;
    court: string;
    judge: string;
    opposing: string;
    openedDaysAgo: number;
    assistant?: boolean;
  };
  const casesData: CaseSeed[] = [
    {
      title: 'Litige commercial — impayés fournisseur',
      type: 'COMMERCIAL',
      status: 'IN_PROGRESS',
      priority: 'URGENT',
      client: 2,
      lawyerId: lawyer.id,
      court: 'Tribunal de Commerce de Casablanca',
      judge: 'M. Hassan Berrada',
      opposing: 'Maghreb Distribution SA',
      openedDaysAgo: 120,
      assistant: true,
    },
    {
      title: 'Divorce par consentement mutuel',
      type: 'FAMILY',
      status: 'OPEN',
      priority: 'MEDIUM',
      client: 1,
      lawyerId: lawyer.id,
      court: 'Tribunal de Première Instance de Rabat',
      judge: 'Mme Nadia Lahlou',
      opposing: 'M. Rachid Alaoui',
      openedDaysAgo: 45,
      assistant: true,
    },
    {
      title: 'Licenciement abusif',
      type: 'LABOR',
      status: 'IN_PROGRESS',
      priority: 'HIGH',
      client: 0,
      lawyerId: lawyer.id,
      court: 'Tribunal Social de Casablanca',
      judge: 'M. Driss Fassi',
      opposing: 'Textiles du Nord SARL',
      openedDaysAgo: 90,
    },
    {
      title: 'Contentieux immobilier — vice caché',
      type: 'REAL_ESTATE',
      status: 'PENDING',
      priority: 'HIGH',
      client: 3,
      lawyerId: lawyer.id,
      court: 'Tribunal de Première Instance de Tanger',
      judge: 'Mme Leila Squalli',
      opposing: 'Immobilière du Détroit',
      openedDaysAgo: 200,
    },
    {
      title: 'Défense pénale — abus de confiance',
      type: 'CRIMINAL',
      status: 'IN_PROGRESS',
      priority: 'URGENT',
      client: 4,
      lawyerId: lawyer.id,
      court: "Cour d'Appel de Fès",
      judge: 'M. Abdelkader Kettani',
      opposing: 'Ministère public',
      openedDaysAgo: 60,
      assistant: true,
    },
    {
      title: 'Recouvrement de créance',
      type: 'CIVIL',
      status: 'CLOSED',
      priority: 'LOW',
      client: 0,
      lawyerId: lawyer.id,
      court: 'Tribunal de Première Instance de Casablanca',
      judge: 'M. Youssef Naciri',
      opposing: 'M. Samir Ouazzani',
      openedDaysAgo: 300,
    },
    {
      title: 'Recours contre décision administrative',
      type: 'ADMINISTRATIVE',
      status: 'OPEN',
      priority: 'MEDIUM',
      client: 7,
      lawyerId: lawyer.id,
      court: 'Tribunal Administratif de Marrakech',
      judge: 'Mme Samira Benjelloun',
      opposing: 'Commune de Marrakech',
      openedDaysAgo: 20,
    },
    {
      title: 'Succession et partage',
      type: 'FAMILY',
      status: 'OPEN',
      priority: 'LOW',
      client: 5,
      lawyerId: lawyer2.id,
      court: "Tribunal de Première Instance d'Agadir",
      judge: 'M. Hamid Ouali',
      opposing: 'Héritiers Tazi',
      openedDaysAgo: 30,
    },
    {
      title: 'Contrefaçon de marque',
      type: 'COMMERCIAL',
      status: 'IN_PROGRESS',
      priority: 'HIGH',
      client: 6,
      lawyerId: lawyer2.id,
      court: 'Tribunal de Commerce de Tanger',
      judge: 'Mme Amal Rifi',
      opposing: 'Styles Import SARL',
      openedDaysAgo: 75,
    },
  ];

  const year = new Date().getFullYear();
  const cases = [];
  for (const [index, data] of casesData.entries()) {
    const openingDate = at(-data.openedDaysAgo);
    const record = await prisma.case.create({
      data: {
        referenceNumber: `CASE-${year}-${String(index + 1).padStart(4, '0')}`,
        title: data.title,
        description: `Dossier suivi par le cabinet. ${data.title}.`,
        caseType: data.type,
        status: data.status,
        priority: data.priority,
        clientId: clients[data.client].id,
        lawyerId: data.lawyerId,
        court: data.court,
        judge: data.judge,
        opposingParty: data.opposing,
        openingDate,
        closingDate: data.status === 'CLOSED' ? at(-10) : null,
        assignments: data.assistant ? { create: [{ userId: assistant.id }] } : undefined,
      },
    });
    cases.push(record);
    await prisma.activityLog.create({
      data: {
        userId: data.lawyerId,
        action: 'case.created',
        entity: 'CASE',
        entityId: record.id,
        caseId: record.id,
        clientId: record.clientId,
        metadata: { referenceNumber: record.referenceNumber, title: record.title },
        createdAt: openingDate,
      },
    });
  }

  type HearingSeed = {
    caseIndex: number;
    when: Date;
    type: HearingType;
    status?: 'SCHEDULED' | 'COMPLETED' | 'POSTPONED';
    notes?: string;
    location?: string;
  };
  const hearingsData: HearingSeed[] = [
    {
      caseIndex: 0,
      when: at(0, 15, 30),
      type: 'PLEADING',
      location: 'Salle 3',
      notes: 'Apporter les bons de livraison originaux.',
    },
    { caseIndex: 4, when: at(1, 9, 0), type: 'PROCEDURAL', location: 'Salle 1' },
    { caseIndex: 2, when: at(1, 11, 30), type: 'CONCILIATION', location: 'Bureau de conciliation' },
    { caseIndex: 1, when: at(3, 10, 0), type: 'FIRST_HEARING', location: 'Salle 5' },
    { caseIndex: 3, when: at(7, 9, 30), type: 'EXPERTISE', location: 'Sur site — Tanger' },
    { caseIndex: 6, when: at(12, 14, 0), type: 'FIRST_HEARING', location: 'Salle 2' },
    { caseIndex: 0, when: at(21, 10, 0), type: 'DELIBERATION', location: 'Salle 3' },
    {
      caseIndex: 4,
      when: at(-3, 9, 0),
      type: 'PLEADING',
      location: 'Salle 1',
      notes: 'Compte rendu à saisir.',
    },
    {
      caseIndex: 2,
      when: at(-20, 10, 0),
      type: 'FIRST_HEARING',
      status: 'COMPLETED',
      notes: 'Renvoi pour conciliation.',
    },
    {
      caseIndex: 5,
      when: at(-40, 11, 0),
      type: 'JUDGMENT',
      status: 'COMPLETED',
      notes: 'Jugement favorable rendu.',
    },
    { caseIndex: 7, when: at(5, 10, 0), type: 'FIRST_HEARING', location: 'Salle 4' },
    { caseIndex: 8, when: at(2, 15, 0), type: 'PLEADING', location: 'Salle 2' },
  ];
  for (const data of hearingsData) {
    const caseRecord = cases[data.caseIndex];
    const hearing = await prisma.hearing.create({
      data: {
        caseId: caseRecord.id,
        date: data.when,
        time: hhmm(data.when),
        court: caseRecord.court,
        location: data.location,
        type: data.type,
        status: data.status ?? 'SCHEDULED',
        notes: data.notes,
      },
    });
    await prisma.activityLog.create({
      data: {
        userId: caseRecord.lawyerId,
        action: data.status === 'COMPLETED' ? 'hearing.completed' : 'hearing.created',
        entity: 'HEARING',
        entityId: hearing.id,
        caseId: caseRecord.id,
        clientId: caseRecord.clientId,
        metadata: { date: hearing.date.toISOString(), time: hearing.time, court: hearing.court },
      },
    });
  }

  const documentsData: Array<{ caseIndex: number; name: string; type: DocumentType }> = [
    { caseIndex: 0, name: 'Bons de livraison.pdf', type: 'EVIDENCE' },
    { caseIndex: 0, name: 'Assignation.pdf', type: 'COURT_DOCUMENT' },
    { caseIndex: 1, name: 'CIN client.pdf', type: 'IDENTITY' },
    { caseIndex: 2, name: 'Contrat de travail.pdf', type: 'CONTRACT' },
    { caseIndex: 3, name: "Rapport d'expertise.pdf", type: 'EVIDENCE' },
    { caseIndex: 4, name: 'Procès-verbal.pdf', type: 'COURT_DOCUMENT' },
  ];
  const documents = [];
  for (const data of documentsData) {
    const caseRecord = cases[data.caseIndex];
    const buffer = minimalPdf(`${caseRecord.referenceNumber} - ${data.name}`);
    const key = `documents/${year}/${randomUUID()}.pdf`;
    await storage.save(key, buffer, 'application/pdf');
    documents.push(
      await prisma.document.create({
        data: {
          caseId: caseRecord.id,
          clientId: caseRecord.clientId,
          name: data.name,
          type: data.type,
          fileUrl: key,
          mimeType: 'application/pdf',
          size: buffer.length,
          uploadedBy: caseRecord.lawyerId,
        },
      }),
    );
  }

  await prisma.contract.createMany({
    data: [
      {
        clientId: clients[2].id,
        caseId: cases[0].id,
        title: "Convention d'honoraires — Atlas Négoce",
        startDate: at(-120),
        endDate: at(245),
        status: 'ACTIVE',
        value: 60000,
      },
      {
        clientId: clients[1].id,
        caseId: cases[1].id,
        title: 'Mandat de représentation — divorce',
        startDate: at(-45),
        endDate: at(12),
        status: 'ACTIVE',
        value: 15000,
      },
      {
        clientId: clients[0].id,
        caseId: cases[2].id,
        documentId: documents[3].id,
        title: 'Convention — litige prud’homal',
        startDate: at(-90),
        endDate: at(25),
        status: 'ACTIVE',
        value: 20000,
      },
      {
        clientId: clients[0].id,
        caseId: cases[5].id,
        title: 'Convention — recouvrement',
        startDate: at(-300),
        endDate: at(-15),
        status: 'EXPIRED',
        value: 8000,
      },
      {
        clientId: clients[3].id,
        title: 'Abonnement conseil juridique annuel',
        startDate: at(-200),
        endDate: at(165),
        status: 'ACTIVE',
        value: 36000,
      },
    ],
  });

  type InvoiceSeed = {
    client: number;
    caseIndex?: number;
    status: InvoiceStatus;
    issued: number;
    due: number;
    items: Array<[string, number, number]>;
    paid?: number;
    createdBy?: string;
  };
  const invoicesData: InvoiceSeed[] = [
    {
      client: 2,
      caseIndex: 0,
      status: 'PAID',
      issued: -150,
      due: -120,
      items: [['Provision sur honoraires', 1, 20000]],
      paid: 1,
    },
    {
      client: 2,
      caseIndex: 0,
      status: 'PARTIALLY_PAID',
      issued: -40,
      due: 10,
      items: [
        ['Rédaction des conclusions', 1, 12000],
        ['Audiences (forfait)', 3, 2500],
      ],
      paid: 0.5,
    },
    {
      client: 1,
      caseIndex: 1,
      status: 'SENT',
      issued: -10,
      due: 2,
      items: [
        ['Consultation initiale', 1, 1500],
        ['Rédaction de la requête', 1, 4000],
      ],
    },
    {
      client: 0,
      caseIndex: 2,
      status: 'OVERDUE',
      issued: -60,
      due: -20,
      items: [['Honoraires — phase de conciliation', 1, 8000]],
    },
    {
      client: 4,
      caseIndex: 4,
      status: 'SENT',
      issued: -5,
      due: 25,
      items: [
        ['Assistance garde à vue', 1, 5000],
        ['Étude du dossier pénal', 6, 750],
      ],
    },
    {
      client: 0,
      caseIndex: 5,
      status: 'PAID',
      issued: -200,
      due: -170,
      items: [
        ['Honoraires de recouvrement', 1, 6000],
        ['Frais de commissaire de justice', 1, 1200],
      ],
      paid: 1,
    },
    {
      client: 7,
      caseIndex: 6,
      status: 'DRAFT',
      issued: 0,
      due: 30,
      items: [['Analyse de la décision administrative', 1, 3500]],
    },
    {
      client: 3,
      caseIndex: 3,
      status: 'PAID',
      issued: -95,
      due: -65,
      items: [['Honoraires expertise judiciaire', 1, 9000]],
      paid: 1,
    },
    {
      client: 5,
      caseIndex: 7,
      status: 'SENT',
      issued: -15,
      due: 15,
      items: [['Ouverture du dossier succession', 1, 4500]],
      createdBy: lawyer2.id,
    },
    {
      client: 6,
      caseIndex: 8,
      status: 'PAID',
      issued: -70,
      due: -40,
      items: [
        ['Mise en demeure', 1, 2500],
        ['Assignation', 1, 6000],
      ],
      paid: 1,
      createdBy: lawyer2.id,
    },
  ];
  for (const [index, data] of invoicesData.entries()) {
    const totals = calculateInvoiceTotals(
      data.items.map(([description, quantity, unitPrice]) => ({
        description,
        quantity,
        unitPrice,
      })),
      20,
    );
    const amountPaid = Math.round(totals.total * (data.paid ?? 0) * 100) / 100;
    const invoice = await prisma.invoice.create({
      data: {
        invoiceNumber: `INV-${year}-${String(index + 1).padStart(4, '0')}`,
        clientId: clients[data.client].id,
        caseId: data.caseIndex !== undefined ? cases[data.caseIndex].id : null,
        createdById: data.createdBy ?? lawyer.id,
        amount: totals.subtotal,
        taxRate: 20,
        tax: totals.tax,
        total: totals.total,
        amountPaid,
        status: data.status,
        issueDate: at(data.issued),
        dueDate: at(data.due),
        paidAt: data.status === 'PAID' ? at(data.due - 3) : null,
        items: { create: totals.items },
      },
    });
    await prisma.activityLog.create({
      data: {
        userId: invoice.createdById,
        action: 'invoice.created',
        entity: 'INVOICE',
        entityId: invoice.id,
        caseId: invoice.caseId,
        clientId: invoice.clientId,
        metadata: { invoiceNumber: invoice.invoiceNumber, total: totals.total },
        createdAt: invoice.issueDate,
      },
    });
  }

  await prisma.notification.createMany({
    data: [
      {
        userId: lawyer.id,
        type: 'CASE_UPDATED',
        title: 'Case updated',
        message: `${cases[0].referenceNumber} — ${cases[0].title}`,
        relatedEntity: 'CASE',
        relatedEntityId: cases[0].id,
        data: {
          event: 'status',
          reference: cases[0].referenceNumber,
          title: cases[0].title,
          status: 'IN_PROGRESS',
        },
      },
      {
        userId: lawyer.id,
        type: 'DOCUMENT_UPLOADED',
        title: 'New document',
        message: `${documents[0].name} — ${cases[0].referenceNumber}`,
        relatedEntity: 'DOCUMENT',
        relatedEntityId: documents[0].id,
        data: { name: documents[0].name, reference: cases[0].referenceNumber, caseId: cases[0].id },
      },
      {
        userId: admin.id,
        type: 'CASE_UPDATED',
        title: 'New case assigned',
        message: `${cases[6].referenceNumber} — ${cases[6].title}`,
        relatedEntity: 'CASE',
        relatedEntityId: cases[6].id,
        data: { event: 'assigned', reference: cases[6].referenceNumber, title: cases[6].title },
      },
    ],
  });

  const result = await runReminderJob();
  console.log('Automatic reminders generated:', result);
  console.log(`Seed complete. Demo accounts use the password documented in README.md.`);
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
