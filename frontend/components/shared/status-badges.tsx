'use client';

import { useTranslations } from 'next-intl';
import { Badge, type BadgeVariant } from '@/components/ui/badge';
import type {
  CasePriority,
  CaseStatus,
  ContractStatus,
  HearingStatus,
  InvoiceStatus,
  Role,
} from '@/types/api';

const CASE_STATUS: Record<CaseStatus, BadgeVariant> = {
  OPEN: 'info',
  IN_PROGRESS: 'gold',
  PENDING: 'warning',
  CLOSED: 'success',
  ARCHIVED: 'muted',
};

const PRIORITY: Record<CasePriority, BadgeVariant> = {
  LOW: 'muted',
  MEDIUM: 'info',
  HIGH: 'warning',
  URGENT: 'danger',
};

const HEARING_STATUS: Record<HearingStatus, BadgeVariant> = {
  SCHEDULED: 'info',
  COMPLETED: 'success',
  POSTPONED: 'warning',
  CANCELLED: 'muted',
};

const CONTRACT_STATUS: Record<ContractStatus, BadgeVariant> = {
  DRAFT: 'muted',
  ACTIVE: 'success',
  EXPIRED: 'danger',
  TERMINATED: 'muted',
};

const INVOICE_STATUS: Record<InvoiceStatus, BadgeVariant> = {
  DRAFT: 'muted',
  SENT: 'info',
  PAID: 'success',
  PARTIALLY_PAID: 'gold',
  OVERDUE: 'danger',
  CANCELLED: 'muted',
};

export function CaseStatusBadge({ status }: { status: CaseStatus }) {
  const t = useTranslations('enums.caseStatus');
  return <Badge variant={CASE_STATUS[status]}>{t(status)}</Badge>;
}

export function PriorityBadge({ priority }: { priority: CasePriority }) {
  const t = useTranslations('enums.casePriority');
  return (
    <Badge variant={PRIORITY[priority]}>
      <span aria-hidden className="size-1.5 rounded-full bg-current" />
      {t(priority)}
    </Badge>
  );
}

export function HearingStatusBadge({ status }: { status: HearingStatus }) {
  const t = useTranslations('enums.hearingStatus');
  return <Badge variant={HEARING_STATUS[status]}>{t(status)}</Badge>;
}

export function ContractStatusBadge({ status }: { status: ContractStatus }) {
  const t = useTranslations('enums.contractStatus');
  return <Badge variant={CONTRACT_STATUS[status]}>{t(status)}</Badge>;
}

export function InvoiceStatusBadge({ status }: { status: InvoiceStatus }) {
  const t = useTranslations('enums.invoiceStatus');
  return <Badge variant={INVOICE_STATUS[status]}>{t(status)}</Badge>;
}

export function RoleBadge({ role }: { role: Role }) {
  const t = useTranslations('enums.role');
  const variant: BadgeVariant =
    role === 'ADMIN' ? 'default' : role === 'LAWYER' ? 'gold' : 'secondary';
  return <Badge variant={variant}>{t(role)}</Badge>;
}
