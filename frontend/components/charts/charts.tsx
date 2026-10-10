'use client';

import { useLocale, useTranslations } from 'next-intl';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { localeDirection } from '@/i18n/config';
import { EmptyState } from '@/components/shared/states';

export const CHART_COLORS = [
  'var(--chart-1)',
  'var(--chart-2)',
  'var(--chart-3)',
  'var(--chart-4)',
  'var(--chart-5)',
  'oklch(0.55 0.04 260)',
  'oklch(0.8 0.08 80)',
  'oklch(0.45 0.09 300)',
];

export interface ChartDatum {
  key: string;
  label: string;
  value: number;
  color?: string;
}

const tooltipStyle = {
  borderRadius: 8,
  border: '1px solid var(--border)',
  boxShadow: '0 4px 12px rgb(0 0 0 / 0.08)',
  fontSize: 12,
};

function NoData() {
  const t = useTranslations('dashboard.charts');
  return <EmptyState title={t('noData')} className="h-full py-6" />;
}

export function DonutChart({
  data,
  height = 240,
  valueFormatter = String,
  label,
}: {
  data: ChartDatum[];
  height?: number;
  valueFormatter?: (value: number) => string;
  label: string;
}) {
  const visible = data.filter((item) => item.value > 0);
  const total = visible.reduce((sum, item) => sum + item.value, 0);
  if (total === 0) return <NoData />;

  return (
    <figure aria-label={label} className="m-0">
      <div style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={visible}
              dataKey="value"
              nameKey="label"
              innerRadius="58%"
              outerRadius="85%"
              paddingAngle={2}
              stroke="none"
            >
              {visible.map((item, index) => (
                <Cell
                  key={item.key}
                  fill={item.color ?? CHART_COLORS[index % CHART_COLORS.length]}
                />
              ))}
            </Pie>
            <Tooltip
              contentStyle={tooltipStyle}
              formatter={(value) => valueFormatter(Number(value))}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <figcaption>
        <ul className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
          {visible.map((item, index) => (
            <li key={item.key} className="flex items-center gap-2">
              <span
                aria-hidden
                className="size-2.5 shrink-0 rounded-sm"
                style={{ background: item.color ?? CHART_COLORS[index % CHART_COLORS.length] }}
              />
              <span className="text-muted-foreground truncate">{item.label}</span>
              <span className="ms-auto font-medium tabular-nums">{valueFormatter(item.value)}</span>
            </li>
          ))}
        </ul>
      </figcaption>
    </figure>
  );
}

export interface SeriesConfig {
  key: string;
  label: string;
  color: string;
}

export function GroupedBarChart({
  data,
  series,
  xKey,
  height = 260,
  valueFormatter = String,
  label,
  layout = 'horizontal',
}: {
  data: Array<Record<string, string | number>>;
  series: SeriesConfig[];
  xKey: string;
  height?: number;
  valueFormatter?: (value: number) => string;
  label: string;
  layout?: 'horizontal' | 'vertical';
}) {
  const rtl = localeDirection[useLocale()] === 'rtl';
  const empty = data.every((row) => series.every((serie) => !Number(row[serie.key])));
  if (data.length === 0 || empty) return <NoData />;

  const vertical = layout === 'vertical';
  return (
    <figure aria-label={label} className="m-0" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          layout={vertical ? 'vertical' : 'horizontal'}
          margin={{ top: 8, right: 8, left: 8, bottom: 0 }}
        >
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="var(--border)"
            vertical={vertical}
            horizontal={!vertical}
          />
          {vertical ? (
            <>
              <XAxis
                type="number"
                reversed={rtl}
                tickLine={false}
                axisLine={false}
                fontSize={11}
                allowDecimals={false}
              />
              <YAxis
                type="category"
                dataKey={xKey}
                orientation={rtl ? 'right' : 'left'}
                tickLine={false}
                axisLine={false}
                fontSize={11}
                width={110}
              />
            </>
          ) : (
            <>
              <XAxis
                dataKey={xKey}
                reversed={rtl}
                tickLine={false}
                axisLine={false}
                fontSize={11}
              />
              <YAxis
                orientation={rtl ? 'right' : 'left'}
                tickLine={false}
                axisLine={false}
                fontSize={11}
                width={64}
                tickFormatter={(value: number) => valueFormatter(value)}
              />
            </>
          )}
          <Tooltip
            contentStyle={tooltipStyle}
            cursor={{ fill: 'var(--muted)' }}
            formatter={(value) => valueFormatter(Number(value))}
          />
          {series.length > 1 && (
            <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
          )}
          {series.map((serie) => (
            <Bar
              key={serie.key}
              dataKey={serie.key}
              name={serie.label}
              fill={serie.color}
              radius={vertical ? [0, 4, 4, 0] : [4, 4, 0, 0]}
              maxBarSize={vertical ? 18 : 28}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </figure>
  );
}
