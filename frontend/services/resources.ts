import { api } from '@/lib/api-client';
import type {
  AdminUser,
  CaseDetail,
  CaseListItem,
  CasePriority,
  CaseStatus,
  CaseType,
  Client,
  ClientProfile,
  Contract,
  ContractStatus,
  DashboardStats,
  DocumentItem,
  DocumentType,
  Hearing,
  HearingStatus,
  HearingType,
  Invoice,
  InvoiceListMeta,
  InvoiceStatus,
  ListParams,
  NotificationItem,
  NotificationMeta,
  ActivityEntry,
  ReminderJobResult,
  Reports,
  Role,
  Settings,
  User,
  UserLookup,
} from '@/types/api';

// ----------------------------------------------------------------- Clients
export interface ClientFilters extends ListParams {
  archived?: 'true' | 'false' | 'all';
  lawyerId?: string;
}

export interface ClientInput {
  firstName: string;
  lastName: string;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  nationalId?: string | null;
  notes?: string | null;
  lawyerId?: string | null;
}

export const clientsService = {
  list: (params: ClientFilters) => api.list<Client>('/api/clients', { ...params }),
  get: (id: string) => api.get<ClientProfile>(`/api/clients/${id}`),
  timeline: (id: string) => api.get<ActivityEntry[]>(`/api/clients/${id}/timeline`),
  create: (input: ClientInput) => api.post<Client>('/api/clients', input),
  update: (id: string, input: Partial<ClientInput>) => api.put<Client>(`/api/clients/${id}`, input),
  archive: (id: string) => api.delete(`/api/clients/${id}`),
  restore: (id: string) => api.post<Client>(`/api/clients/${id}/restore`),
};

// ------------------------------------------------------------------- Cases
export interface CaseFilters extends ListParams {
  status?: CaseStatus[];
  priority?: CasePriority[];
  caseType?: CaseType[];
  clientId?: string;
  lawyerId?: string;
  court?: string;
  from?: string;
  to?: string;
}

export interface CaseInput {
  title: string;
  referenceNumber?: string;
  description?: string | null;
  caseType: CaseType;
  status: CaseStatus;
  priority: CasePriority;
  clientId: string;
  lawyerId?: string;
  court?: string | null;
  judge?: string | null;
  opposingParty?: string | null;
  openingDate?: string | null;
  closingDate?: string | null;
  assistantIds?: string[];
}

export const casesService = {
  list: (params: CaseFilters) => api.list<CaseListItem>('/api/cases', { ...params }),
  get: (id: string) => api.get<CaseDetail>(`/api/cases/${id}`),
  timeline: (id: string) => api.get<ActivityEntry[]>(`/api/cases/${id}/timeline`),
  create: (input: CaseInput) => api.post<CaseDetail>('/api/cases', input),
  update: (id: string, input: Partial<CaseInput>) => api.put<CaseDetail>(`/api/cases/${id}`, input),
  close: (id: string) => api.post<CaseDetail>(`/api/cases/${id}/close`),
  reopen: (id: string) => api.post<CaseDetail>(`/api/cases/${id}/reopen`),
  remove: (id: string) => api.delete(`/api/cases/${id}`),
};

// ---------------------------------------------------------------- Hearings
export type HearingRange = 'today' | 'tomorrow' | 'week' | 'upcoming' | 'overdue';

export interface HearingFilters extends ListParams {
  range?: HearingRange;
  status?: HearingStatus[];
  caseId?: string;
  clientId?: string;
  court?: string;
  from?: string;
  to?: string;
}

export interface HearingInput {
  caseId: string;
  date: string;
  time: string;
  type: HearingType;
  status?: HearingStatus;
  court?: string | null;
  location?: string | null;
  notes?: string | null;
}

export const hearingsService = {
  list: (params: HearingFilters) => api.list<Hearing>('/api/hearings', { ...params }),
  get: (id: string) => api.get<Hearing>(`/api/hearings/${id}`),
  create: (input: HearingInput) => api.post<Hearing>('/api/hearings', input),
  update: (id: string, input: Partial<Omit<HearingInput, 'caseId'>>) =>
    api.put<Hearing>(`/api/hearings/${id}`, input),
  complete: (id: string, notes?: string) =>
    api.post<Hearing>(`/api/hearings/${id}/complete`, { notes }),
  remove: (id: string) => api.delete(`/api/hearings/${id}`),
};

// --------------------------------------------------------------- Documents
export interface DocumentFilters extends ListParams {
  type?: DocumentType[];
  caseId?: string;
  clientId?: string;
}

export const documentsService = {
  list: (params: DocumentFilters) => api.list<DocumentItem>('/api/documents', { ...params }),
  upload: (form: FormData) => api.post<DocumentItem>('/api/documents', form),
  update: (id: string, input: { name?: string; type?: DocumentType }) =>
    api.patch<DocumentItem>(`/api/documents/${id}`, input),
  remove: (id: string) => api.delete(`/api/documents/${id}`),
  file: (id: string, inline = false) =>
    api.blob(`/api/documents/${id}/download`, inline ? { inline: 'true' } : {}),
};

// --------------------------------------------------------------- Contracts
export interface ContractFilters extends ListParams {
  status?: ContractStatus[];
  view?: 'active' | 'expired' | 'expiring';
  clientId?: string;
  caseId?: string;
}

export interface ContractInput {
  clientId: string;
  caseId?: string | null;
  documentId?: string | null;
  title: string;
  description?: string | null;
  startDate: string;
  endDate?: string | null;
  status: ContractStatus;
  value?: number | null;
}

export const contractsService = {
  list: (params: ContractFilters) => api.list<Contract>('/api/contracts', { ...params }),
  get: (id: string) => api.get<Contract>(`/api/contracts/${id}`),
  create: (input: ContractInput) => api.post<Contract>('/api/contracts', input),
  update: (id: string, input: Partial<ContractInput>) =>
    api.put<Contract>(`/api/contracts/${id}`, input),
  remove: (id: string) => api.delete(`/api/contracts/${id}`),
};

// ---------------------------------------------------------------- Invoices
export interface InvoiceFilters extends ListParams {
  status?: InvoiceStatus[];
  clientId?: string;
  caseId?: string;
  from?: string;
  to?: string;
}

export interface InvoiceInput {
  clientId: string;
  caseId?: string | null;
  items: Array<{ description: string; quantity: number; unitPrice: number }>;
  taxRate?: number;
  issueDate?: string | null;
  dueDate?: string | null;
  notes?: string | null;
  status: 'DRAFT' | 'SENT';
}

export const invoicesService = {
  list: (params: InvoiceFilters) =>
    api.list<Invoice, InvoiceListMeta>('/api/invoices', { ...params }),
  get: (id: string) => api.get<Invoice>(`/api/invoices/${id}`),
  create: (input: InvoiceInput) => api.post<Invoice>('/api/invoices', input),
  update: (id: string, input: Partial<Omit<InvoiceInput, 'clientId'>>) =>
    api.put<Invoice>(`/api/invoices/${id}`, input),
  pay: (id: string, input: { amount?: number; paidAt?: string }) =>
    api.post<Invoice>(`/api/invoices/${id}/pay`, input),
  cancel: (id: string) => api.post<Invoice>(`/api/invoices/${id}/cancel`),
  remove: (id: string) => api.delete(`/api/invoices/${id}`),
};

// ----------------------------------------------------------- Notifications
export const notificationsService = {
  list: (params: { page?: number; pageSize?: number; unreadOnly?: boolean; type?: string[] }) =>
    api.list<NotificationItem, NotificationMeta>('/api/notifications', {
      ...params,
      unreadOnly: params.unreadOnly ? 'true' : undefined,
    }),
  unreadCount: () => api.get<{ count: number }>('/api/notifications/unread-count'),
  markRead: (id: string) => api.patch<NotificationItem>(`/api/notifications/${id}/read`),
  markAllRead: () => api.patch<{ updated: number }>('/api/notifications/read-all'),
  remove: (id: string) => api.delete(`/api/notifications/${id}`),
};

// --------------------------------------------------- Users / system / stats
export interface UserInput {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string | null;
  role: Role;
  isActive?: boolean;
  password?: string;
}

export const usersService = {
  list: (params: ListParams & { role?: Role[]; isActive?: string }) =>
    api.list<AdminUser>('/api/users', { ...params }),
  lookup: (roles?: Role[]) => api.get<UserLookup[]>('/api/users/lookup', { role: roles }),
  create: (input: UserInput & { password: string }) => api.post<User>('/api/users', input),
  update: (id: string, input: Partial<UserInput>) => api.put<User>(`/api/users/${id}`, input),
};

export const systemService = {
  dashboard: () => api.get<DashboardStats>('/api/dashboard/stats'),
  reports: (params: { from?: string; to?: string; lawyerId?: string }) =>
    api.get<Reports>('/api/reports', { ...params }),
  settings: () => api.get<Settings>('/api/settings'),
  updateSettings: (input: Partial<Omit<Settings, 'id' | 'updatedAt'>>) =>
    api.put<Settings>('/api/settings', input),
  runReminders: () => api.post<ReminderJobResult>('/api/admin/jobs/reminders'),
};
