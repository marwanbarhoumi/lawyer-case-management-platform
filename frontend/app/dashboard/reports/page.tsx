'use client';

import { useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import {
  CalendarClock,
  Download,
  FolderCheck,
  FolderOpen,
  Hourglass,
  Percent,
  Receipt,
  TriangleAlert,
  Wallet,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { RoleGate } from '@/components/auth/role-gate';
import { DonutChart, GroupedBarChart } from '@/components/charts/charts';
import { useAuth } from '@/components/providers/auth-provider';
import { FormField } from '@/components/shared/form-field';
import { PageHeader } from '@/components/shared/page-header';
import { SearchSelect } from '@/components/shared/search-select';
import { EmptyState, ErrorState, PageSkeleton } from '@/components/shared/states';
import { StatCard } from '@/components/shared/stat-card';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useFormat } from '@/hooks/use-format';
import { todayInput, zonedDateTimeToIso } from '@/lib/dates';
import { userOptionsLoader } from '@/lib/option-loaders';
import { systemService } from '@/services/resources';
import type { Reports } from '@/types/api';

const loadLawyers = userOptionsLoader(['LAWYER', 'ADMIN']);

function defaultFrom(): string {
  const today = todayInput();
  const year = Number(today.slice(0, 4));
  const month = Number(today.slice(5, 7));
  const index = year * 12 + (month - 1) - 11;
  return `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, '0')}-01`;
}

function csvCell(value: string | number): string {
  const text = String(value);
  return /[",;\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function ReportsView() {
  const t = useTranslations('reports');
  const common = useTranslations('common');
  const enums = useTranslations('enums');
  const format = useFormat();
  const { hasRole } = useAuth();
  const [draft, setDraft] = useState({
    from: defaultFrom(),
    to: todayInput(),
    lawyerId: null as string | null,
  });
  const [applied, setApplied] = useState(draft);

  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ['reports', applied],
    queryFn: () =>
      systemService.reports({
        from: applied.from ? zonedDateTimeToIso(applied.from, '00:00') : undefined,
        to: applied.to ? zonedDateTimeToIso(applied.to, '23:59') : undefined,
        lawyerId: applied.lawyerId ?? undefined,
      }),
    placeholderData: keepPreviousData,
  });

  const exportCsv = (report: Reports) => {
    const header = [
      'month',
      t('charts.opened'),
      t('charts.closed'),
      t('charts.hearings'),
      t('kpis.invoiced'),
      t('kpis.collected'),
    ];
    const rows = report.monthly.map((row) => [
      row.month,
      row.opened,
      row.closed,
      row.hearings,
      row.invoiced,
      row.paid,
    ]);
    const csv = [header, ...rows].map((row) => row.map(csvCell).join(';')).join('\n');
    const url = URL.createObjectURL(new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `report-${applied.from}-${applied.to}.csv`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('title')}
        description={t('subtitle')}
        actions={
          data && (
            <Button variant="outline" onClick={() => exportCsv(data)}>
              <Download /> {common('exportCsv')}
            </Button>
          )
        }
      />

      <Card className="no-print">
        <CardContent>
          <form
            className="grid gap-4 sm:grid-cols-2 lg:grid-cols-[repeat(3,minmax(0,14rem))_auto] lg:items-end"
            onSubmit={(event) => {
              event.preventDefault();
              setApplied(draft);
            }}
          >
            <FormField label={common('from')}>
              <Input
                type="date"
                value={draft.from}
                max={draft.to}
                onChange={(event) => setDraft({ ...draft, from: event.target.value })}
              />
            </FormField>
            <FormField label={common('to')}>
              <Input
                type="date"
                value={draft.to}
                min={draft.from}
                onChange={(event) => setDraft({ ...draft, to: event.target.value })}
              />
            </FormField>
            {hasRole('ADMIN') && (
              <FormField label={t('lawyer')}>
                <SearchSelect
                  queryKey="lawyers"
                  value={draft.lawyerId}
                  onChange={(value) => setDraft({ ...draft, lawyerId: value })}
                  loadOptions={loadLawyers}
                  placeholder={t('allLawyers')}
                  clearable
                />
              </FormField>
            )}
            <Button type="submit" loading={isFetching}>
              {t('apply')}
            </Button>
          </form>
        </CardContent>
      </Card>

      {isLoading && <PageSkeleton />}
      {error && <ErrorState error={error} onRetry={() => refetch()} />}
      {data && (
        <>
          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              label={t('kpis.openedCases')}
              value={format.number(data.cases.openedInRange)}
              icon={FolderOpen}
            />
            <StatCard
              label={t('kpis.closedCases')}
              value={format.number(data.cases.closedInRange)}
              icon={FolderCheck}
              tone="success"
            />
            <StatCard
              label={t('kpis.averageDuration')}
              value={
                data.cases.averageDurationDays === null
                  ? '—'
                  : t('kpis.averageDurationValue', {
                      days: Math.round(data.cases.averageDurationDays),
                    })
              }
              icon={Hourglass}
              tone="gold"
            />
            <StatCard
              label={t('kpis.hearings')}
              value={format.number(data.hearings.total)}
              icon={CalendarClock}
            />
            <StatCard
              label={t('kpis.invoiced')}
              value={format.money(data.finance.invoiced)}
              icon={Receipt}
            />
            <StatCard
              label={t('kpis.collected')}
              value={format.money(data.finance.collected)}
              icon={Wallet}
              tone="success"
            />
            <StatCard
              label={t('kpis.outstanding')}
              value={format.money(data.finance.outstanding)}
              hint={`${t('kpis.overdue')} : ${format.money(data.finance.overdue)}`}
              icon={TriangleAlert}
              tone={data.finance.overdue > 0 ? 'danger' : 'navy'}
            />
            <StatCard
              label={t('kpis.collectionRate')}
              value={`${format.number(Math.round(data.finance.collectionRate * 10) / 10)} %`}
              icon={Percent}
              tone="gold"
            />
          </section>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>{t('charts.activity')}</CardTitle>
              </CardHeader>
              <CardContent>
                <GroupedBarChart
                  label={t('charts.activity')}
                  xKey="month"
                  data={data.monthly.map((row) => ({
                    month: format.monthLabel(row.month),
                    opened: row.opened,
                    closed: row.closed,
                    hearings: row.hearings,
                  }))}
                  series={[
                    { key: 'opened', label: t('charts.opened'), color: 'var(--chart-1)' },
                    { key: 'closed', label: t('charts.closed'), color: 'var(--chart-4)' },
                    { key: 'hearings', label: t('charts.hearings'), color: 'var(--chart-2)' },
                  ]}
                />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>{t('charts.revenue')}</CardTitle>
              </CardHeader>
              <CardContent>
                <GroupedBarChart
                  label={t('charts.revenue')}
                  xKey="month"
                  valueFormatter={(value) => format.money(value)}
                  data={data.monthly.map((row) => ({
                    month: format.monthLabel(row.month),
                    invoiced: row.invoiced,
                    paid: row.paid,
                  }))}
                  series={[
                    { key: 'invoiced', label: t('kpis.invoiced'), color: 'var(--chart-1)' },
                    { key: 'paid', label: t('kpis.collected'), color: 'var(--chart-2)' },
                  ]}
                />
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle>{t('charts.byStatus')}</CardTitle>
              </CardHeader>
              <CardContent>
                <DonutChart
                  label={t('charts.byStatus')}
                  data={data.cases.byStatus.map((row) => ({
                    key: row.status,
                    label: enums(`caseStatus.${row.status}`),
                    value: row.count,
                  }))}
                />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>{t('charts.byPriority')}</CardTitle>
              </CardHeader>
              <CardContent>
                <DonutChart
                  label={t('charts.byPriority')}
                  data={data.cases.byPriority.map((row) => ({
                    key: row.priority,
                    label: enums(`casePriority.${row.priority}`),
                    value: row.count,
                  }))}
                />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>{t('charts.hearingsByStatus')}</CardTitle>
              </CardHeader>
              <CardContent>
                <DonutChart
                  label={t('charts.hearingsByStatus')}
                  data={data.hearings.byStatus.map((row) => ({
                    key: row.status,
                    label: enums(`hearingStatus.${row.status}`),
                    value: row.count,
                  }))}
                />
              </CardContent>
            </Card>
            <Card className="md:col-span-2">
              <CardHeader>
                <CardTitle>{t('charts.byType')}</CardTitle>
              </CardHeader>
              <CardContent>
                <GroupedBarChart
                  label={t('charts.byType')}
                  layout="vertical"
                  xKey="label"
                  data={data.cases.byType.map((row) => ({
                    label: enums(`caseType.${row.type}`),
                    count: row.count,
                  }))}
                  series={[{ key: 'count', label: t('count'), color: 'var(--chart-1)' }]}
                />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>{t('charts.invoicesByStatus')}</CardTitle>
              </CardHeader>
              <CardContent>
                <DonutChart
                  label={t('charts.invoicesByStatus')}
                  valueFormatter={(value) => format.money(value)}
                  data={data.finance.byStatus.map((row) => ({
                    key: row.status,
                    label: enums(`invoiceStatus.${row.status}`),
                    value: row.total,
                  }))}
                />
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card className="gap-0 pb-0">
              <CardHeader className="pb-4">
                <CardTitle>{t('topClients')}</CardTitle>
              </CardHeader>
              {data.finance.topClients.length === 0 ? (
                <EmptyState title={common('noResults')} />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead>{common('name')}</TableHead>
                      <TableHead className="text-end">{t('kpis.invoiced')}</TableHead>
                      <TableHead className="text-end">{t('kpis.collected')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.finance.topClients.map((row) => (
                      <TableRow key={row.clientId}>
                        <TableCell className="font-medium">{row.name}</TableCell>
                        <TableCell className="text-end tabular-nums">
                          {format.money(row.invoiced)}
                        </TableCell>
                        <TableCell className="text-end tabular-nums">
                          {format.money(row.paid)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </Card>
            <Card className="gap-0 pb-0">
              <CardHeader className="pb-4">
                <CardTitle>{t('lawyerWorkload')}</CardTitle>
              </CardHeader>
              {data.lawyers.length === 0 ? (
                <EmptyState title={common('noResults')} />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead>{t('lawyer')}</TableHead>
                      <TableHead className="text-end">{t('activeCases')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.lawyers.map((row) => (
                      <TableRow key={row.id}>
                        <TableCell className="font-medium">{row.name}</TableCell>
                        <TableCell className="text-end tabular-nums">{row.activeCases}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </Card>
          </div>
        </>
      )}
    </div>
  );
}

export default function ReportsPage() {
  return (
    <RoleGate roles={['ADMIN', 'LAWYER']}>
      <ReportsView />
    </RoleGate>
  );
}
