'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import {
  AlertTriangle,
  Bell,
  CalendarClock,
  FileWarning,
  FolderKanban,
  Plus,
  Receipt,
  Users,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { DonutChart, GroupedBarChart } from '@/components/charts/charts';
import { HearingRow } from '@/components/hearings/hearing-row';
import { NotificationIcon } from '@/components/notifications/notification-icon';
import { useNotificationView } from '@/components/notifications/notification-view';
import { useAuth, useCurrentUser } from '@/components/providers/auth-provider';
import { ActivityTimeline } from '@/components/shared/activity-timeline';
import { PageHeader } from '@/components/shared/page-header';
import { EmptyState, ErrorState, PageSkeleton } from '@/components/shared/states';
import { StatCard } from '@/components/shared/stat-card';
import { CaseStatusBadge, PriorityBadge } from '@/components/shared/status-badges';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useFormat } from '@/hooks/use-format';
import { cn, fullName } from '@/lib/utils';
import { systemService } from '@/services/resources';
import type { CaseStatus, DashboardStats } from '@/types/api';

const STATUS_COLORS: Record<CaseStatus, string> = {
  OPEN: 'var(--chart-3)',
  IN_PROGRESS: 'var(--chart-2)',
  PENDING: 'oklch(0.75 0.14 60)',
  CLOSED: 'var(--chart-4)',
  ARCHIVED: 'oklch(0.7 0.02 260)',
};

type HearingTab = keyof DashboardStats['hearings'];

function HearingsWidget({ hearings }: { hearings: DashboardStats['hearings'] }) {
  const t = useTranslations('dashboard.hearings');
  const common = useTranslations('common');
  const initial: HearingTab =
    hearings.today.length > 0 ? 'today' : hearings.overdue.length > 0 ? 'overdue' : 'upcoming';
  const [tab, setTab] = useState<HearingTab>(initial);
  const tabs: HearingTab[] = ['today', 'tomorrow', 'upcoming', 'overdue'];

  return (
    <Card className="lg:col-span-2">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CalendarClock className="text-gold size-4" aria-hidden />
          {t('title')}
        </CardTitle>
        <Button asChild variant="link" size="sm" className="h-auto p-0">
          <Link href={`/dashboard/hearings?range=${tab === 'tomorrow' ? 'tomorrow' : tab}`}>
            {common('viewAll')}
          </Link>
        </Button>
      </CardHeader>
      <CardContent>
        <Tabs value={tab} onValueChange={(value) => setTab(value as HearingTab)}>
          <TabsList className="mb-4 w-full sm:w-auto">
            {tabs.map((key) => (
              <TabsTrigger
                key={key}
                value={key}
                className={cn(
                  key === 'overdue' && hearings.overdue.length > 0 && 'text-destructive',
                )}
              >
                {t(key)}
                <span className="bg-background/70 ms-1.5 rounded-full px-1.5 text-[11px] tabular-nums">
                  {hearings[key].length}
                </span>
              </TabsTrigger>
            ))}
          </TabsList>
          {tabs.map((key) => (
            <TabsContent key={key} value={key} className="space-y-2">
              {key === 'overdue' && hearings.overdue.length > 0 && (
                <p className="text-destructive flex items-center gap-2 text-sm">
                  <AlertTriangle className="size-4" aria-hidden />
                  {t('overdueHint')}
                </p>
              )}
              {hearings[key].length === 0 ? (
                <EmptyState title={t('empty')} icon={CalendarClock} className="py-8" />
              ) : (
                hearings[key].map((hearing) => (
                  <HearingRow key={hearing.id} hearing={hearing} overdue={key === 'overdue'} />
                ))
              )}
            </TabsContent>
          ))}
        </Tabs>
      </CardContent>
    </Card>
  );
}

function DeadlinesWidget({ finance }: { finance: NonNullable<DashboardStats['finance']> }) {
  const t = useTranslations('dashboard.deadlines');
  const format = useFormat();
  const empty = finance.expiringContracts.length === 0 && finance.overdueInvoices.length === 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileWarning className="text-gold size-4" aria-hidden />
          {t('title')}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {empty && <EmptyState title={t('empty')} className="py-8" />}
        {finance.overdueInvoices.length > 0 && (
          <section>
            <h3 className="text-destructive mb-2 text-xs font-semibold tracking-wide uppercase">
              {t('overdueInvoices')}
            </h3>
            <ul className="space-y-2">
              {finance.overdueInvoices.map((invoice) => (
                <li key={invoice.id}>
                  <Link
                    href={`/dashboard/invoices/${invoice.id}`}
                    className="hover:bg-muted flex items-center justify-between gap-3 rounded-md p-2"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium">
                        {invoice.invoiceNumber} · {fullName(invoice.client)}
                      </span>
                      <span className="text-muted-foreground block text-xs">
                        {t('dueOn', { date: format.date(invoice.dueDate) })}
                      </span>
                    </span>
                    <span className="text-destructive shrink-0 text-sm font-semibold tabular-nums">
                      {format.money(invoice.balance)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}
        {finance.expiringContracts.length > 0 && (
          <section>
            <h3 className="mb-2 text-xs font-semibold tracking-wide text-amber-700 uppercase">
              {t('expiringContracts')}
            </h3>
            <ul className="space-y-2">
              {finance.expiringContracts.map((contract) => (
                <li key={contract.id}>
                  <Link
                    href={`/dashboard/contracts/${contract.id}`}
                    className="hover:bg-muted block rounded-md p-2"
                  >
                    <span className="block truncate text-sm font-medium">{contract.title}</span>
                    <span className="text-muted-foreground block text-xs">
                      {fullName(contract.client)} ·{' '}
                      {t('endsOn', { date: format.date(contract.endDate) })}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}
      </CardContent>
    </Card>
  );
}

function NotificationsWidget({
  notifications,
}: {
  notifications: DashboardStats['notifications'];
}) {
  const t = useTranslations('dashboard');
  const common = useTranslations('common');
  const view = useNotificationView();
  const format = useFormat();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bell className="text-gold size-4" aria-hidden />
          {t('notifications')}
          {notifications.unread > 0 && (
            <span className="bg-destructive rounded-full px-1.5 text-[11px] text-white tabular-nums">
              {notifications.unread}
            </span>
          )}
        </CardTitle>
        <Button asChild variant="link" size="sm" className="h-auto p-0">
          <Link href="/dashboard/notifications">{common('viewAll')}</Link>
        </Button>
      </CardHeader>
      <CardContent>
        {notifications.latest.length === 0 ? (
          <EmptyState title={t('noNotifications')} icon={Bell} className="py-8" />
        ) : (
          <ul className="space-y-3">
            {notifications.latest.map((notification) => {
              const { title, message, href } = view(notification);
              const body = (
                <>
                  <NotificationIcon type={notification.type} />
                  <span className="min-w-0">
                    <span className="block text-sm font-medium">{title}</span>
                    <span className="text-muted-foreground line-clamp-2 block text-xs">
                      {message}
                    </span>
                    <span className="text-muted-foreground/80 block text-[11px]">
                      {format.relative(notification.createdAt)}
                    </span>
                  </span>
                </>
              );
              return (
                <li key={notification.id}>
                  {href ? (
                    <Link href={href} className="hover:bg-muted flex gap-3 rounded-md p-1">
                      {body}
                    </Link>
                  ) : (
                    <div className="flex gap-3 p-1">{body}</div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

export default function DashboardPage() {
  const t = useTranslations('dashboard');
  const enums = useTranslations('enums');
  const user = useCurrentUser();
  const { hasRole } = useAuth();
  const format = useFormat();
  const isManager = hasRole('ADMIN', 'LAWYER');
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['dashboard'],
    queryFn: systemService.dashboard,
  });

  if (isLoading) return <PageSkeleton />;
  if (error || !data) return <ErrorState error={error} onRetry={() => refetch()} />;

  const { totals, finance } = data;

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('welcome', { name: user.firstName })}
        description={
          <span className="capitalize">
            {format.dateLong(new Date())} — {t('subtitle')}
          </span>
        }
        actions={
          <>
            {isManager && (
              <>
                <Button asChild variant="outline">
                  <Link href="/dashboard/clients/new">
                    <Plus /> {t('quickActions.newClient')}
                  </Link>
                </Button>
                <Button asChild variant="outline">
                  <Link href="/dashboard/cases/new">
                    <Plus /> {t('quickActions.newCase')}
                  </Link>
                </Button>
              </>
            )}
            <Button asChild variant="gold">
              <Link href="/dashboard/hearings/new">
                <CalendarClock /> {t('quickActions.newHearing')}
              </Link>
            </Button>
          </>
        }
      />

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label={t('subtitle')}>
        <StatCard
          label={t('stats.clients')}
          value={format.number(totals.clients)}
          icon={Users}
          href="/dashboard/clients"
        />
        <StatCard
          label={t('stats.activeCases')}
          value={format.number(totals.activeCases)}
          icon={FolderKanban}
          href="/dashboard/cases"
        />
        <StatCard
          label={t('stats.upcomingHearings')}
          value={format.number(totals.upcomingHearings)}
          icon={CalendarClock}
          tone="gold"
          href="/dashboard/hearings?range=upcoming"
          hint={
            data.hearings.today.length > 0
              ? `${t('hearings.today')} : ${data.hearings.today.length}`
              : undefined
          }
        />
        {finance ? (
          <StatCard
            label={t('stats.pendingInvoices')}
            value={format.number(totals.pendingInvoices)}
            icon={Receipt}
            tone={finance.overdueInvoices.length > 0 ? 'danger' : 'success'}
            hint={t('stats.pendingAmount', { amount: format.money(totals.pendingAmount) })}
            href="/dashboard/invoices"
          />
        ) : (
          <StatCard
            label={t('notifications')}
            value={format.number(data.notifications.unread)}
            icon={Bell}
            href="/dashboard/notifications"
          />
        )}
      </section>

      <div className="grid gap-6 lg:grid-cols-3">
        <HearingsWidget hearings={data.hearings} />
        {finance ? (
          <DeadlinesWidget finance={finance} />
        ) : (
          <NotificationsWidget notifications={data.notifications} />
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{t('charts.casesByStatus')}</CardTitle>
          </CardHeader>
          <CardContent>
            <DonutChart
              label={t('charts.casesByStatus')}
              data={data.casesByStatus.map((item) => ({
                key: item.status,
                label: enums(`caseStatus.${item.status}`),
                value: item.count,
                color: STATUS_COLORS[item.status],
              }))}
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>{t('charts.casesByType')}</CardTitle>
          </CardHeader>
          <CardContent>
            <GroupedBarChart
              label={t('charts.casesByType')}
              layout="vertical"
              xKey="label"
              data={data.casesByType.map((item) => ({
                label: enums(`caseType.${item.type}`),
                count: item.count,
              }))}
              series={[{ key: 'count', label: t('charts.cases'), color: 'var(--chart-1)' }]}
            />
          </CardContent>
        </Card>
      </div>

      {finance && (
        <div className="grid gap-6 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>{t('charts.monthlyInvoices')}</CardTitle>
            </CardHeader>
            <CardContent>
              <GroupedBarChart
                label={t('charts.monthlyInvoices')}
                xKey="month"
                valueFormatter={(value) => format.money(value)}
                data={finance.monthly.map((row) => ({
                  month: format.monthLabel(row.month),
                  invoiced: row.invoiced,
                  paid: row.paid,
                }))}
                series={[
                  { key: 'invoiced', label: t('charts.invoiced'), color: 'var(--chart-1)' },
                  { key: 'paid', label: t('charts.paid'), color: 'var(--chart-2)' },
                ]}
              />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>{t('charts.paidVsUnpaid')}</CardTitle>
            </CardHeader>
            <CardContent>
              <DonutChart
                label={t('charts.paidVsUnpaid')}
                valueFormatter={(value) => format.money(value)}
                data={[
                  {
                    key: 'paid',
                    label: t('charts.paid'),
                    value: finance.paidVsUnpaid.paid,
                    color: 'var(--chart-4)',
                  },
                  {
                    key: 'unpaid',
                    label: t('charts.unpaid'),
                    value: finance.paidVsUnpaid.unpaid,
                    color: 'var(--chart-5)',
                  },
                ]}
              />
            </CardContent>
          </Card>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>{t('recentActivity')}</CardTitle>
          </CardHeader>
          <CardContent>
            <ActivityTimeline entries={data.recentActivity} />
          </CardContent>
        </Card>
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="text-destructive size-4" aria-hidden />
                {t('urgentCases')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {data.urgentCases.length === 0 ? (
                <EmptyState title={t('noUrgent')} className="py-6" />
              ) : (
                <ul className="space-y-2">
                  {data.urgentCases.map((item) => (
                    <li key={item.id}>
                      <Link
                        href={`/dashboard/cases/${item.id}`}
                        className="hover:bg-muted block rounded-md p-2"
                      >
                        <span className="flex items-center justify-between gap-2">
                          <span className="truncate text-sm font-medium">{item.title}</span>
                          <PriorityBadge priority={item.priority} />
                        </span>
                        <span className="text-muted-foreground mt-1 flex items-center gap-2 text-xs">
                          {item.referenceNumber} · {fullName(item.client)}
                          <CaseStatusBadge status={item.status} />
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
          {finance && <NotificationsWidget notifications={data.notifications} />}
        </div>
      </div>
    </div>
  );
}
