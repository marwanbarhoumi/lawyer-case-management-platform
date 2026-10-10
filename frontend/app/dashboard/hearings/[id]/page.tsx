'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BellRing, CalendarCheck2, CheckCircle2, Pencil, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { HearingForm } from '@/components/hearings/hearing-form';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { PageHeader } from '@/components/shared/page-header';
import { ErrorState, PageSkeleton } from '@/components/shared/states';
import { HearingStatusBadge } from '@/components/shared/status-badges';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/input';
import { useErrorToast } from '@/hooks/use-error-message';
import { useFormat } from '@/hooks/use-format';
import { todayInput, zonedDay } from '@/lib/dates';
import { fullName } from '@/lib/utils';
import { hearingsService } from '@/services/resources';

function CompleteDialog({ hearingId, onDone }: { hearingId: string; onDone: () => void }) {
  const t = useTranslations('hearings');
  const common = useTranslations('common');
  const [open, setOpen] = useState(false);
  const [notes, setNotes] = useState('');
  const showError = useErrorToast();
  const mutation = useMutation({
    mutationFn: () => hearingsService.complete(hearingId, notes.trim() || undefined),
    onSuccess: () => {
      toast.success(t('completed'));
      setOpen(false);
      onDone();
    },
    onError: showError,
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <CheckCircle2 /> {t('complete')}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('completeTitle')}</DialogTitle>
          <DialogDescription>{t('completeDescription')}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-1.5">
          <Label htmlFor="hearing-complete-notes">{t('completeNotes')}</Label>
          <Textarea
            id="hearing-complete-notes"
            rows={5}
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            {common('cancel')}
          </Button>
          <Button loading={mutation.isPending} onClick={() => mutation.mutate()}>
            {common('confirm')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-muted-foreground text-xs">{label}</dt>
      <dd className="mt-0.5 text-sm">{children || '—'}</dd>
    </div>
  );
}

export default function HearingDetailPage() {
  const t = useTranslations('hearings');
  const common = useTranslations('common');
  const enums = useTranslations('enums');
  const casesT = useTranslations('cases');
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const format = useFormat();
  const queryClient = useQueryClient();
  const showError = useErrorToast();
  const [editing, setEditing] = useState(false);
  const {
    data: hearing,
    isLoading,
    error,
    refetch,
  } = useQuery({ queryKey: ['hearings', id], queryFn: () => hearingsService.get(id) });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['hearings'] });
    queryClient.invalidateQueries({ queryKey: ['cases'] });
    queryClient.invalidateQueries({ queryKey: ['dashboard'] });
  };
  const remove = useMutation({
    mutationFn: () => hearingsService.remove(id),
    onSuccess: () => {
      invalidate();
      toast.success(common('deleted'));
      router.replace('/dashboard/hearings');
    },
    onError: showError,
  });

  if (isLoading) return <PageSkeleton />;
  if (error || !hearing) return <ErrorState error={error} onRetry={() => refetch()} />;

  const overdue = hearing.status === 'SCHEDULED' && zonedDay(hearing.date) < todayInput();

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader
        title={
          <span className="flex flex-wrap items-center gap-3">
            {enums(`hearingType.${hearing.type}`)}
            {overdue ? (
              <Badge variant="danger">{t('overdueBadge')}</Badge>
            ) : (
              <HearingStatusBadge status={hearing.status} />
            )}
          </span>
        }
        description={
          <span className="capitalize">
            {format.dateLong(hearing.date)} · {hearing.time}
          </span>
        }
        actions={
          !editing && (
            <>
              {hearing.status !== 'COMPLETED' && hearing.status !== 'CANCELLED' && (
                <CompleteDialog hearingId={hearing.id} onDone={invalidate} />
              )}
              <Button variant="outline" onClick={() => setEditing(true)}>
                <Pencil /> {common('edit')}
              </Button>
              <ConfirmDialog
                title={t('deleteTitle')}
                description={t('deleteDescription')}
                confirmLabel={common('delete')}
                onConfirm={() => remove.mutateAsync()}
                trigger={
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-destructive"
                    aria-label={common('delete')}
                  >
                    <Trash2 />
                  </Button>
                }
              />
            </>
          )
        }
      />

      {editing ? (
        <Card>
          <CardHeader>
            <CardTitle>{t('editTitle')}</CardTitle>
          </CardHeader>
          <CardContent>
            <HearingForm
              hearing={hearing}
              onSaved={() => {
                setEditing(false);
                refetch();
              }}
              onCancel={() => setEditing(false)}
            />
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CalendarCheck2 className="text-gold size-4" aria-hidden />
                {common('details')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid gap-5 sm:grid-cols-2">
                <Detail label={t('case')}>
                  <Link
                    href={`/dashboard/cases/${hearing.case.id}`}
                    className="text-navy font-medium hover:underline"
                  >
                    {hearing.case.referenceNumber} — {hearing.case.title}
                  </Link>
                </Detail>
                <Detail label={casesT('client')}>
                  <Link
                    href={`/dashboard/clients/${hearing.case.client.id}`}
                    className="hover:underline"
                  >
                    {fullName(hearing.case.client)}
                  </Link>
                </Detail>
                <Detail label={t('date')}>
                  <span className="capitalize">{format.dateLong(hearing.date)}</span>
                </Detail>
                <Detail label={t('time')}>
                  <span className="tabular-nums">{hearing.time}</span>
                </Detail>
                <Detail label={t('court')}>{hearing.court}</Detail>
                <Detail label={t('location')}>{hearing.location}</Detail>
                {hearing.case.lawyer && (
                  <Detail label={enums('role.LAWYER')}>{fullName(hearing.case.lawyer)}</Detail>
                )}
              </dl>
              {hearing.notes && (
                <div className="bg-muted/60 mt-6 rounded-lg p-4">
                  <p className="text-muted-foreground mb-1 text-xs font-medium">{t('notes')}</p>
                  <p className="text-sm whitespace-pre-line">{hearing.notes}</p>
                </div>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BellRing className="text-gold size-4" aria-hidden />
                {t('reminders')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <p className="text-muted-foreground">{t('remindersText')}</p>
              <ol className="flex gap-2" aria-label={t('reminders')}>
                {(['7d', '3d', '1d', '0d'] as const).map((stage) => (
                  <li key={stage}>
                    <Badge variant={hearing.reminderSent ? 'success' : 'secondary'}>
                      {t(`stages.${stage}`)}
                    </Badge>
                  </li>
                ))}
              </ol>
              <p className={hearing.reminderSent ? 'text-emerald-700' : 'text-foreground'}>
                {hearing.reminderSent ? t('reminderDone') : t('reminderPending')}
              </p>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
