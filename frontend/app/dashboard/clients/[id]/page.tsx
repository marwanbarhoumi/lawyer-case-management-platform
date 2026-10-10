'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Archive,
  ArchiveRestore,
  CalendarClock,
  FolderKanban,
  IdCard,
  Mail,
  MapPin,
  Pencil,
  Phone,
  Plus,
  Wallet,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import {
  CasesPanel,
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
import { StatCard } from '@/components/shared/stat-card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useErrorToast } from '@/hooks/use-error-message';
import { useFormat } from '@/hooks/use-format';
import { fullName } from '@/lib/utils';
import { clientsService } from '@/services/resources';

function InfoRow({
  icon: Icon,
  label,
  children,
}: {
  icon: typeof Mail;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex gap-3">
      <Icon className="text-muted-foreground mt-0.5 size-4 shrink-0" aria-hidden />
      <div className="min-w-0">
        <dt className="text-muted-foreground text-xs">{label}</dt>
        <dd className="text-sm break-words">{children || '—'}</dd>
      </div>
    </div>
  );
}

function ClientTimeline({ clientId }: { clientId: string }) {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['clients', clientId, 'timeline'],
    queryFn: () => clientsService.timeline(clientId),
  });
  if (isLoading) return <Skeleton className="h-40 w-full" />;
  if (error || !data) return <ErrorState error={error} onRetry={() => refetch()} />;
  return <ActivityTimeline entries={data} />;
}

export default function ClientProfilePage() {
  const t = useTranslations('clients');
  const common = useTranslations('common');
  const casesT = useTranslations('cases');
  const { id } = useParams<{ id: string }>();
  const { hasRole } = useAuth();
  const format = useFormat();
  const queryClient = useQueryClient();
  const showError = useErrorToast();
  const canManage = hasRole('ADMIN', 'LAWYER');
  const {
    data: client,
    isLoading,
    error,
    refetch,
  } = useQuery({ queryKey: ['clients', id], queryFn: () => clientsService.get(id) });

  const toggleArchive = useMutation({
    mutationFn: async (): Promise<unknown> =>
      client?.isArchived ? clientsService.restore(id) : clientsService.archive(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      toast.success(client?.isArchived ? t('restored') : t('archived'));
    },
    onError: showError,
  });

  if (isLoading) return <PageSkeleton />;
  if (error || !client) return <ErrorState error={error} onRetry={() => refetch()} />;

  const { summary } = client;

  return (
    <div className="space-y-6">
      <PageHeader
        title={
          <span className="flex flex-wrap items-center gap-3">
            {fullName(client)}
            {client.isArchived && <Badge variant="muted">{t('archivedBadge')}</Badge>}
          </span>
        }
        description={t('since', { date: format.date(client.createdAt) })}
        actions={
          canManage && (
            <>
              {!client.isArchived && (
                <Button asChild variant="gold">
                  <Link href={`/dashboard/cases/new?clientId=${client.id}`}>
                    <Plus /> {casesT('new')}
                  </Link>
                </Button>
              )}
              <Button asChild variant="outline">
                <Link href={`/dashboard/clients/${client.id}/edit`}>
                  <Pencil /> {common('edit')}
                </Link>
              </Button>
              {client.isArchived ? (
                <Button
                  variant="outline"
                  loading={toggleArchive.isPending}
                  onClick={() => toggleArchive.mutate()}
                >
                  <ArchiveRestore /> {t('restore')}
                </Button>
              ) : (
                <ConfirmDialog
                  title={t('archiveTitle')}
                  description={t('archiveDescription')}
                  confirmLabel={t('archive')}
                  onConfirm={() => toggleArchive.mutateAsync()}
                  trigger={
                    <Button variant="outline">
                      <Archive /> {t('archive')}
                    </Button>
                  }
                />
              )}
            </>
          )
        }
      />

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label={t('summary.activeCases')}
          value={summary.activeCases}
          icon={FolderKanban}
        />
        <StatCard
          label={t('summary.upcomingHearings')}
          value={summary.upcomingHearings}
          icon={CalendarClock}
          tone="gold"
        />
        {canManage && (
          <>
            <StatCard
              label={t('summary.totalInvoiced')}
              value={format.money(summary.totalInvoiced)}
              hint={`${t('summary.totalPaid')} : ${format.money(summary.totalPaid)}`}
              icon={Wallet}
            />
            <StatCard
              label={t('summary.balance')}
              value={format.money(summary.balance)}
              icon={Wallet}
              tone={summary.balance > 0 ? 'danger' : 'success'}
            />
          </>
        )}
      </section>

      <Tabs defaultValue="overview">
        <TabsList className="flex h-auto w-full flex-wrap justify-start">
          <TabsTrigger value="overview">{t('tabs.overview')}</TabsTrigger>
          <TabsTrigger value="cases">{t('tabs.cases')}</TabsTrigger>
          <TabsTrigger value="hearings">{t('tabs.hearings')}</TabsTrigger>
          <TabsTrigger value="documents">{t('tabs.documents')}</TabsTrigger>
          {canManage && <TabsTrigger value="contracts">{t('tabs.contracts')}</TabsTrigger>}
          {canManage && <TabsTrigger value="invoices">{t('tabs.invoices')}</TabsTrigger>}
          <TabsTrigger value="activity">{t('tabs.activity')}</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4 grid gap-6 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>{t('personalInfo')}</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid gap-5 sm:grid-cols-2">
                <InfoRow icon={Mail} label={common('email')}>
                  <span dir="ltr">{client.email}</span>
                </InfoRow>
                <InfoRow icon={Phone} label={common('phone')}>
                  <span dir="ltr">{client.phone}</span>
                </InfoRow>
                <InfoRow icon={IdCard} label={t('nationalId')}>
                  {client.nationalId}
                </InfoRow>
                <InfoRow icon={MapPin} label={common('address')}>
                  {client.address}
                </InfoRow>
                <InfoRow icon={FolderKanban} label={t('lawyer')}>
                  {client.lawyer ? fullName(client.lawyer) : t('noLawyer')}
                </InfoRow>
              </dl>
              {client.notes && (
                <div className="bg-muted/60 mt-6 rounded-lg p-4">
                  <p className="text-muted-foreground mb-1 text-xs font-medium">{t('notes')}</p>
                  <p className="text-sm whitespace-pre-line">{client.notes}</p>
                </div>
              )}
            </CardContent>
          </Card>
          {canManage && (
            <Card>
              <CardHeader>
                <CardTitle>{t('paymentStatus')}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <dl className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">{t('summary.totalInvoiced')}</dt>
                    <dd className="font-medium tabular-nums">
                      {format.money(summary.totalInvoiced)}
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">{t('summary.totalPaid')}</dt>
                    <dd className="font-medium text-emerald-700 tabular-nums">
                      {format.money(summary.totalPaid)}
                    </dd>
                  </div>
                  <div className="flex justify-between border-t pt-3">
                    <dt className="font-medium">{t('summary.balance')}</dt>
                    <dd
                      className={`font-semibold tabular-nums ${summary.balance > 0 ? 'text-destructive' : ''}`}
                    >
                      {format.money(summary.balance)}
                    </dd>
                  </div>
                </dl>
                {summary.totalInvoiced > 0 && (
                  <div
                    className="bg-muted h-2 overflow-hidden rounded-full"
                    role="progressbar"
                    aria-label={t('summary.totalPaid')}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={Math.round((summary.totalPaid / summary.totalInvoiced) * 100)}
                  >
                    <div
                      className="h-full rounded-full bg-emerald-500"
                      style={{
                        width: `${Math.min(100, (summary.totalPaid / summary.totalInvoiced) * 100)}%`,
                      }}
                    />
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="cases" className="mt-4">
          <Card className="gap-0 py-0">
            <CasesPanel clientId={client.id} canCreate={canManage && !client.isArchived} />
          </Card>
        </TabsContent>
        <TabsContent value="hearings" className="mt-4">
          <Card className="gap-0 py-0">
            <HearingsPanel clientId={client.id} canCreate={false} />
          </Card>
        </TabsContent>
        <TabsContent value="documents" className="mt-4">
          <Card className="gap-0 py-0">
            <DocumentsPanel clientId={client.id} />
          </Card>
        </TabsContent>
        {canManage && (
          <TabsContent value="contracts" className="mt-4">
            <Card className="gap-0 py-0">
              <ContractsPanel clientId={client.id} />
            </Card>
          </TabsContent>
        )}
        {canManage && (
          <TabsContent value="invoices" className="mt-4">
            <Card className="gap-0 py-0">
              <InvoicesPanel clientId={client.id} />
            </Card>
          </TabsContent>
        )}
        <TabsContent value="activity" className="mt-4">
          <Card>
            <CardContent>
              <ClientTimeline clientId={client.id} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
