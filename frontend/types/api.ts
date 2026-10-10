export const ROLES = ['ADMIN', 'LAWYER', 'ASSISTANT'] as const;
export const CASE_STATUSES = ['OPEN', 'IN_PROGRESS', 'PENDING', 'CLOSED', 'ARCHIVED'] as const;
export const CASE_PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'] as const;
export const CASE_TYPES = [
  'CIVIL',
  'CRIMINAL',
  'COMMERCIAL',
  'FAMILY',
  'LABOR',
  'ADMINISTRATIVE',
  'REAL_ESTATE',
  'OTHER',
] as const;
export const HEARING_STATUSES = ['SCHEDULED', 'COMPLETED', 'POSTPONED', 'CANCELLED'] as const;
export const HEARING_TYPES = [
  'FIRST_HEARING',
  'PROCEDURAL',
  'PLEADING',
  'DELIBERATION',
  'JUDGMENT',
  'CONCILIATION',
  'EXPERTISE',
  'OTHER',
] as const;
export const DOCUMENT_TYPES = [
  'IDENTITY',
  'CONTRACT',
  'COURT_DOCUMENT',
  'EVIDENCE',
  'INVOICE',
  'OTHER',
] as const;
export const CONTRACT_STATUSES = ['DRAFT', 'ACTIVE', 'EXPIRED', 'TERMINATED'] as const;
export const INVOICE_STATUSES = [
  'DRAFT',
  'SENT',
  'PAID',
  'PARTIALLY_PAID',
  'OVERDUE',
  'CANCELLED',
] as const;
export const NOTIFICATION_TYPES = [
  'HEARING_REMINDER',
  'CONTRACT_EXPIRING',
  'INVOICE_DUE',
  'INVOICE_OVERDUE',
  'CASE_UPDATED',
  'DOCUMENT_UPLOADED',
] as const;

export type Role = (typeof ROLES)[number];
export type CaseStatus = (typeof CASE_STATUSES)[number];
export type CasePriority = (typeof CASE_PRIORITIES)[number];
export type CaseType = (typeof CASE_TYPES)[number];
export type HearingStatus = (typeof HEARING_STATUSES)[number];
export type HearingType = (typeof HEARING_TYPES)[number];
export type DocumentType = (typeof DOCUMENT_TYPES)[number];
export type ContractStatus = (typeof CONTRACT_STATUSES)[number];
export type InvoiceStatus = (typeof INVOICE_STATUSES)[number];
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];
export type EntityType =
  'USER' | 'CLIENT' | 'CASE' | 'HEARING' | 'DOCUMENT' | 'CONTRACT' | 'INVOICE' | 'SETTINGS';

export interface PaginationMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface Paginated<T, M = PaginationMeta> {
  data: T[];
  meta: M;
}

export interface PersonRef {
  id: string;
  firstName: string;
  lastName: string;
}

export interface User extends PersonRef {
  email: string;
  phone: string | null;
  role: Role;
  avatar: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AdminUser extends User {
  _count: { cases: number; clients: number; caseAssignments: number };
}

export interface UserLookup extends PersonRef {
  role: Role;
  email: string;
}

export interface Client extends PersonRef {
  email: string | null;
  phone: string | null;
  address: string | null;
  nationalId: string | null;
  notes: string | null;
  lawyerId: string | null;
  lawyer: PersonRef | null;
  isArchived: boolean;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
  _count: { cases: number; documents?: number; contracts?: number; invoices?: number };
}

export interface ClientProfile extends Client {
  summary: {
    activeCases: number;
    upcomingHearings: number;
    totalInvoiced: number;
    totalPaid: number;
    balance: number;
  };
}

export interface HearingRef {
  id: string;
  date: string;
  time: string;
  court: string | null;
}

export interface CaseListItem {
  id: string;
  referenceNumber: string;
  title: string;
  description: string | null;
  caseType: CaseType;
  status: CaseStatus;
  priority: CasePriority;
  clientId: string;
  lawyerId: string;
  court: string | null;
  judge: string | null;
  opposingParty: string | null;
  openingDate: string;
  closingDate: string | null;
  createdAt: string;
  updatedAt: string;
  client: PersonRef;
  lawyer: PersonRef;
  nextHearing: HearingRef | null;
  _count: { hearings: number; documents: number };
}

export interface CaseDetail extends Omit<
  CaseListItem,
  'nextHearing' | '_count' | 'client' | 'lawyer'
> {
  client: PersonRef & { email: string | null; phone: string | null };
  lawyer: PersonRef & { email: string };
  assistants: Array<PersonRef & { role: Role }>;
  _count: { hearings: number; documents: number; contracts: number; invoices: number };
}

export interface Hearing {
  id: string;
  caseId: string;
  date: string;
  time: string;
  location: string | null;
  court: string | null;
  type: HearingType;
  notes: string | null;
  status: HearingStatus;
  reminderSent: boolean;
  createdAt: string;
  updatedAt: string;
  case: {
    id: string;
    referenceNumber: string;
    title: string;
    status?: CaseStatus;
    court?: string | null;
    client: PersonRef;
    lawyer?: PersonRef;
  };
}

export interface DocumentItem {
  id: string;
  caseId: string | null;
  clientId: string | null;
  name: string;
  type: DocumentType;
  mimeType: string;
  size: number;
  uploadedBy: string | null;
  createdAt: string;
  downloadUrl: string;
  case: { id: string; referenceNumber: string; title: string } | null;
  client: PersonRef | null;
  uploader: PersonRef | null;
}

export interface Contract {
  id: string;
  clientId: string;
  caseId: string | null;
  documentId: string | null;
  title: string;
  description: string | null;
  startDate: string;
  endDate: string | null;
  status: ContractStatus;
  value: string | null;
  createdAt: string;
  updatedAt: string;
  client: PersonRef;
  case: { id: string; referenceNumber: string; title: string } | null;
  document: { id: string; name: string; mimeType: string; size: number } | null;
}

export interface InvoiceItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  clientId: string;
  caseId: string | null;
  amount: number;
  taxRate: number;
  tax: number;
  total: number;
  amountPaid: number;
  balance: number;
  status: InvoiceStatus;
  issueDate: string;
  dueDate: string;
  paidAt: string | null;
  notes: string | null;
  createdAt: string;
  client: PersonRef & { email?: string | null; phone?: string | null; address?: string | null };
  case: { id: string; referenceNumber: string; title: string } | null;
  createdBy?: PersonRef | null;
  items?: InvoiceItem[];
}

export interface InvoiceListMeta extends PaginationMeta {
  sumTotal: number;
  sumPaid: number;
}

export interface NotificationItem {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  isRead: boolean;
  relatedEntity: EntityType | null;
  relatedEntityId: string | null;
  data: Record<string, string | number | null> | null;
  createdAt: string;
}

export interface NotificationMeta extends PaginationMeta {
  unreadCount: number;
}

export interface ActivityEntry {
  id: string;
  userId: string | null;
  action: string;
  entity: EntityType;
  entityId: string;
  caseId: string | null;
  clientId: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  user: (PersonRef & { role: Role }) | null;
}

export interface Settings {
  id: string;
  firmName: string;
  firmEmail: string | null;
  firmPhone: string | null;
  firmAddress: string | null;
  taxIdentifier: string | null;
  currency: string;
  defaultTaxRate: number;
  invoiceDueDays: number;
  contractExpiryWarningDays: number;
  invoiceDueWarningDays: number;
  updatedAt: string;
}

export interface DashboardHearing {
  id: string;
  date: string;
  time: string;
  court: string | null;
  location: string | null;
  type: HearingType;
  status: HearingStatus;
  case: { id: string; referenceNumber: string; title: string; client: PersonRef };
}

export interface DashboardStats {
  totals: {
    clients: number;
    activeCases: number;
    upcomingHearings: number;
    pendingInvoices: number;
    pendingAmount: number;
  };
  hearings: {
    today: DashboardHearing[];
    tomorrow: DashboardHearing[];
    upcoming: DashboardHearing[];
    overdue: DashboardHearing[];
  };
  casesByStatus: Array<{ status: CaseStatus; count: number }>;
  casesByType: Array<{ type: CaseType; count: number }>;
  urgentCases: Array<{
    id: string;
    referenceNumber: string;
    title: string;
    priority: CasePriority;
    status: CaseStatus;
    client: PersonRef;
  }>;
  finance: {
    currency: string;
    monthly: Array<{ month: string; invoiced: number; paid: number }>;
    paidVsUnpaid: { paid: number; unpaid: number };
    byStatus: Array<{ status: InvoiceStatus; count: number }>;
    overdueInvoices: Array<{
      id: string;
      invoiceNumber: string;
      client: PersonRef;
      dueDate: string;
      total: number;
      balance: number;
    }>;
    expiringContracts: Array<{ id: string; title: string; endDate: string; client: PersonRef }>;
  } | null;
  recentActivity: ActivityEntry[];
  notifications: { unread: number; latest: NotificationItem[] };
}

export interface Reports {
  range: { from: string; to: string };
  currency: string;
  cases: {
    byStatus: Array<{ status: CaseStatus; count: number }>;
    byType: Array<{ type: CaseType; count: number }>;
    byPriority: Array<{ priority: CasePriority; count: number }>;
    openedInRange: number;
    closedInRange: number;
    averageDurationDays: number | null;
  };
  hearings: { total: number; byStatus: Array<{ status: HearingStatus; count: number }> };
  finance: {
    invoiced: number;
    collected: number;
    outstanding: number;
    overdue: number;
    collectionRate: number;
    byStatus: Array<{ status: InvoiceStatus; count: number; total: number }>;
    topClients: Array<{ clientId: string; name: string; invoiced: number; paid: number }>;
  };
  monthly: Array<{
    month: string;
    opened: number;
    closed: number;
    hearings: number;
    invoiced: number;
    paid: number;
  }>;
  lawyers: Array<{ id: string; name: string; activeCases: number }>;
}

export interface ReminderJobResult {
  hearingReminders: number;
  contractAlerts: number;
  contractsExpired: number;
  invoiceAlerts: number;
  invoicesOverdue: number;
  durationMs: number;
}

export interface ListParams {
  page?: number;
  pageSize?: number;
  search?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}
