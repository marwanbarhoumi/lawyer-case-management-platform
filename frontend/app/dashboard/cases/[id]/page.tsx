'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarPlus, Info, Lock, LockOpen, Pencil, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import {
  ContractsPanel,
  DocumentsPanel,
  HearingsPanel,
  InvoicesPanel,
} from '@/components/panels/related-panels';
import { useAuth } from '@/components/providers/auth-provider';
import { ActivityTimeline } from '@/components/shared/activity-timeline';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { PageHeader } from '@/components/shared/page-header';
import { ErrorState, PageSkeleton } from '@/components/shared/states';
import { CaseStatusBadge, PriorityBadge, RoleBadge } from '@/components/shared/status-badges';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useErrorToast } from '@/hooks/use-error-message';
import { useFormat } from '@/hooks/use-format';
import { fullName, initials } from '@/lib/utils';
import { casesService } from '@/services/resources';

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-muted-foreground text-xs">{label}</dt>
      <dd className="mt-0.5 text-sm">{children || '—'}</dd>
    </div>
  );
}

function CaseTimeline({ caseId }: { caseId: string }) {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['cases', caseId, 'timeline'],
    queryFn: () => casesService.timeline(caseId),
  });
  if (isLoading) return <Skeleton className="h-40 w-full" />;
  if (error || !data) return <ErrorState error={error} onRetry={() => refetch()} />;
  return <ActivityTimeline entries={data} />;
}

export default function CaseDetailPage() {
  const t = useTranslations('cases');
  const common = useTranslations('common');
  const enums = useTranslations('enums');
  const nav = useTranslations('nav');
  const hearingsT = useTranslations('hearings');
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user, hasRole } = useAuth();
  const format = useFormat();
  const queryClient = useQueryClient();
  const showError = useErrorToast();
  const {
    data: item,
    isLoading,
    error,
    refetch,
  } = useQuery({ queryKey: ['cases', id], queryFn: () => casesService.get(id) });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['cases'] });
    queryClient.invalidateQueries({ queryKey: ['dashboard'] });
  };
  const close = useMutation({
    mutationFn: () => casesService.close(id),
    onSuccess: () => {
      invalidate();
      toast.success(t('closed'));
    },
    onError: showError,
  });
  const reopen = useMutation({
    mutationFn: () => casesService.reopen(id),
    onSuccess: () => {
      invalidate();
      toast.success(t('reopened'));
    },
    onError: showError,
  });
  const remove = useMutation({
    mutationFn: () => casesService.remove(id),
    onSuccess: () => {
      invalidate();
      toast.success(common('deleted'));
      router.replace('/dashboard/cases');
    },
    onError: showError,
  });

  if (isLoading) return <PageSkeleton />;
  if (error || !item) return <ErrorState error={error} onRetry={() => refetch()} />;

  const canModify = hasRole('ADMIN') || item.lawyerId === user?.id;
  const isManager = hasRole('ADMIN', 'LAWYER');
  const isClosed = item.status === 'CLOSED' || item.status === 'ARCHIVED';

  return (
    <div className="space-y-6">
      <PageHeader
        title={item.title}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-xs" dir="ltr">
              {item.referenceNumber}
            </span>
            <CaseStatusBadge status={item.status} />
            <PriorityBadge priority={item.priority} />
            <span>· {enums(`caseType.${item.caseType}`)}</span>
          </span>
        }
        actions={
          <>
            {!isClosed && (
              <Button asChild variant="gold">
                <Link href={`/dashboard/hearings/new?caseId=${item.id}`}>
                  <CalendarPlus /> {hearingsT('new')}
                </Link>
              </Button>
            )}
            {canModify && (
              <>
                <Button asChild variant="outline">
                  <Link href={`/dashboard/cases/${item.id}/edit`}>
                    <Pencil /> {common('edit')}
                  </Link>
                </Button>
                {isClosed ? (
                  <Button
                    variant="outline"
                    loading={reopen.isPending}
                    onClick={() => reopen.mutate()}
                  >
                    <LockOpen /> {t('reopen')}
                  </Button>
                ) : (
                  <ConfirmDialog
                    title={t('closeTitle')}
                    description={t('closeDescription')}
                    confirmLabel={t('close')}
                    destructive={false}
                    onConfirm={() => close.mutateAsync()}
                    trigger={
                      <Button variant="outline">
                        <Lock /> {t('close')}
                      </Button>
                    }
                  />
                )}
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
            )}
          </>
        }
      />

      {!canModify && isManager && (
        <p className="flex items-center gap-2 rounded-lg border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900">
          <Info className="size-4 shrink-0" aria-hidden /> {t('readOnlyHint')}
        </p>
      )}

      <Tabs defaultValue="overview">
        <TabsList className="flex h-auto w-full flex-wrap justify-start">
          <TabsTrigger value="overview">{t('tabs.overview')}</TabsTrigger>
          <TabsTrigger value="hearings">
            {t('tabs.hearings')}{' '}
            <span className="ms-1 text-xs opacity-70">{item._count.hearings}</span>
          </TabsTrigger>
          <TabsTrigger value="documents">
            {t('tabs.documents')}{' '}
            <span className="ms-1 text-xs opacity-70">{item._count.documents}</span>
          </TabsTrigger>
          {isManager && <TabsTrigger value="finance">{t('tabs.finance')}</TabsTrigger>}
          <TabsTrigger value="timeline">{t('tabs.timeline')}</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4 grid gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle>{common('details')}</CardTitle>
              </CardHeader>
              <CardContent>
                <dl className="grid gap-5 sm:grid-cols-2">
                  <Detail label={t('client')}>
                    <Link
                      href={`/dashboard/clients/${item.client.id}`}
                      className="text-navy font-medium hover:underline"
                    >
                      {fullName(item.client)}
                    </Link>
                    {item.client.phone && (
                      <span className="text-muted-foreground block text-xs" dir="ltr">
                        {item.client.phone}
                      </span>
                    )}
                  </Detail>
                  <Detail label={t('type')}>{enums(`caseType.${item.caseType}`)}</Detail>
                  <Detail label={t('openingDate')}>{format.date(item.openingDate)}</Detail>
                  <Detail label={t('closingDate')}>
                    {item.closingDate ? format.date(item.closingDate) : null}
                  </Detail>
                </dl>
                {item.description && (
                  <div className="bg-muted/60 mt-6 rounded-lg p-4">
                    <p className="text-muted-foreground mb-1 text-xs font-medium">
                      {t('description')}
                    </p>
                    <p className="text-sm whitespace-pre-line">{item.description}</p>
                  </div>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>{t('courtInfo')}</CardTitle>
              </CardHeader>
              <CardContent>
                <dl className="grid gap-5 sm:grid-cols-3">
                  <Detail label={t('court')}>{item.court}</Detail>
                  <Detail label={t('judge')}>{item.judge}</Detail>
                  <Detail label={t('opposingParty')}>{item.opposingParty}</Detail>
                </dl>
              </CardContent>
            </Card>
          </div>
          <Card>
            <CardHeader>
              <CardTitle>{t('team')}</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-3">
                <li className="flex items-center gap-3">
                  <Avatar>
                    <AvatarFallback>{initials(item.lawyer)}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{fullName(item.lawyer)}</p>
                    <p className="text-muted-foreground text-xs">{t('lawyer')}</p>
                  </div>
                </li>
                {item.assistants.map((member) => (
                  <li key={member.id} className="flex items-center gap-3">
                    <Avatar>
                      <AvatarFallback>{initials(member)}</AvatarFallback>
                    </Avatar>
                    <p className="min-w-0 flex-1 truncate text-sm">{fullName(member)}</p>
                    <RoleBadge role={member.role} />
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="hearings" className="mt-4">
          <Card className="gap-0 py-0">
            <HearingsPanel caseId={item.id} canCreate={!isClosed} />
          </Card>
        </TabsContent>
        <TabsContent value="documents" className="mt-4">
          <Card className="gap-0 py-0">
            <DocumentsPanel caseId={item.id} />
          </Card>
        </TabsContent>
        {isManager && (
          <TabsContent value="finance" className="mt-4 space-y-6">
            <Card className="gap-0 pt-4 pb-0">
              <CardHeader>
                <CardTitle>{nav('contracts')}</CardTitle>
              </CardHeader>
              <ContractsPanel caseId={item.id} clientId={item.clientId} />
            </Card>
            <Card className="gap-0 pt-4 pb-0">
              <CardHeader>
                <CardTitle>{nav('invoices')}</CardTitle>
              </CardHeader>
              <InvoicesPanel caseId={item.id} clientId={item.clientId} />
            </Card>
          </TabsContent>
        )}
        <TabsContent value="timeline" className="mt-4">
          <Card>
            <CardContent>
              <CaseTimeline caseId={item.id} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
