import {
  AlarmClock,
  FilePlus2,
  FileWarning,
  FolderSync,
  ReceiptText,
  TriangleAlert,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { NotificationType } from '@/types/api';

const CONFIG: Record<NotificationType, { icon: typeof AlarmClock; className: string }> = {
  HEARING_REMINDER: { icon: AlarmClock, className: 'bg-amber-100 text-amber-700' },
  CONTRACT_EXPIRING: { icon: FileWarning, className: 'bg-orange-100 text-orange-700' },
  INVOICE_DUE: { icon: ReceiptText, className: 'bg-sky-100 text-sky-700' },
  INVOICE_OVERDUE: { icon: TriangleAlert, className: 'bg-red-100 text-red-700' },
  CASE_UPDATED: { icon: FolderSync, className: 'bg-indigo-100 text-indigo-700' },
  DOCUMENT_UPLOADED: { icon: FilePlus2, className: 'bg-emerald-100 text-emerald-700' },
};

export function NotificationIcon({
  type,
  className,
}: {
  type: NotificationType;
  className?: string;
}) {
  const { icon: Icon, className: tone } = CONFIG[type];
  return (
    <span
      className={cn(
        'flex size-8 shrink-0 items-center justify-center rounded-full',
        tone,
        className,
      )}
    >
      <Icon className="size-4" aria-hidden />
    </span>
  );
}
