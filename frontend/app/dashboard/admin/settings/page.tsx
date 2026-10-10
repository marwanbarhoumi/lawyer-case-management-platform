'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { BellRing, Play } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { z } from 'zod';
import { RoleGate } from '@/components/auth/role-gate';
import { FormField } from '@/components/shared/form-field';
import { PageHeader } from '@/components/shared/page-header';
import { ErrorState, PageSkeleton } from '@/components/shared/states';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useErrorToast } from '@/hooks/use-error-message';
import { useSettings } from '@/hooks/use-format';
import {
  nullable,
  optionalEmail,
  optionalString,
  phoneSchema,
  requiredString,
} from '@/lib/validation';
import { systemService } from '@/services/resources';
import type { Settings } from '@/types/api';

const integer = (min: number, max: number) =>
  z.number({ message: 'required' }).int('required').min(min, 'nonNegative').max(max, 'maxLength');

const schema = z.object({
  firmName: requiredString(200),
  firmEmail: optionalEmail,
  firmPhone: phoneSchema,
  firmAddress: optionalString(300),
  taxIdentifier: optionalString(100),
  currency: z
    .string()
    .trim()
    .regex(/^[A-Za-z]{3}$/, 'required'),
  defaultTaxRate: z.number({ message: 'required' }).min(0, 'nonNegative').max(100, 'maxLength'),
  invoiceDueDays: integer(0, 365),
  contractExpiryWarningDays: integer(1, 365),
  invoiceDueWarningDays: integer(0, 60),
});
type FormValues = z.infer<typeof schema>;

function SettingsForm({ settings }: { settings: Settings }) {
  const t = useTranslations('admin');
  const common = useTranslations('common');
  const queryClient = useQueryClient();
  const showError = useErrorToast();
  const {
    register,
    handleSubmit,
    formState: { errors, isDirty },
    reset,
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: toFormValues(settings),
  });

  const mutation = useMutation({
    mutationFn: (values: FormValues) =>
      systemService.updateSettings({
        ...values,
        currency: values.currency.toUpperCase(),
        firmEmail: nullable(values.firmEmail),
        firmPhone: nullable(values.firmPhone),
        firmAddress: nullable(values.firmAddress),
        taxIdentifier: nullable(values.taxIdentifier),
      }),
    onSuccess: (saved) => {
      queryClient.setQueryData(['settings'], saved);
      reset(toFormValues(saved));
      toast.success(common('saved'));
    },
    onError: showError,
  });

  return (
    <form
      onSubmit={handleSubmit((values) => mutation.mutate(values))}
      noValidate
      className="space-y-6"
    >
      <Card>
        <CardHeader>
          <CardTitle>{t('firm')}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-5 sm:grid-cols-2">
          <FormField label={t('firmName')} error={errors.firmName} className="sm:col-span-2">
            <Input {...register('firmName')} />
          </FormField>
          <FormField label={t('firmEmail')} error={errors.firmEmail} optional>
            <Input type="email" dir="ltr" {...register('firmEmail')} />
          </FormField>
          <FormField label={t('firmPhone')} error={errors.firmPhone} optional>
            <Input type="tel" dir="ltr" {...register('firmPhone')} />
          </FormField>
          <FormField label={t('firmAddress')} error={errors.firmAddress} optional>
            <Input {...register('firmAddress')} />
          </FormField>
          <FormField label={t('taxIdentifier')} error={errors.taxIdentifier} optional>
            <Input dir="ltr" {...register('taxIdentifier')} />
          </FormField>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>{t('billing')}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-5 sm:grid-cols-3">
          <FormField label={t('currency')} error={errors.currency}>
            <Input dir="ltr" maxLength={3} className="uppercase" {...register('currency')} />
          </FormField>
          <FormField label={t('defaultTaxRate')} error={errors.defaultTaxRate}>
            <Input
              type="number"
              step="0.01"
              min="0"
              max="100"
              dir="ltr"
              {...register('defaultTaxRate', { valueAsNumber: true })}
            />
          </FormField>
          <FormField label={t('invoiceDueDays')} error={errors.invoiceDueDays}>
            <Input
              type="number"
              min="0"
              max="365"
              dir="ltr"
              {...register('invoiceDueDays', { valueAsNumber: true })}
            />
          </FormField>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>{t('alerts')}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-5 sm:grid-cols-2">
          <FormField
            label={t('contractExpiryWarningDays')}
            error={errors.contractExpiryWarningDays}
          >
            <Input
              type="number"
              min="1"
              max="365"
              dir="ltr"
              {...register('contractExpiryWarningDays', { valueAsNumber: true })}
            />
          </FormField>
          <FormField label={t('invoiceDueWarningDays')} error={errors.invoiceDueWarningDays}>
            <Input
              type="number"
              min="0"
              max="60"
              dir="ltr"
              {...register('invoiceDueWarningDays', { valueAsNumber: true })}
            />
          </FormField>
        </CardContent>
      </Card>
      <div className="flex justify-end">
        <Button type="submit" loading={mutation.isPending} disabled={!isDirty}>
          {mutation.isPending ? common('saving') : common('save')}
        </Button>
      </div>
    </form>
  );
}

function toFormValues(settings: Settings): FormValues {
  return {
    firmName: settings.firmName,
    firmEmail: settings.firmEmail ?? '',
    firmPhone: settings.firmPhone ?? '',
    firmAddress: settings.firmAddress ?? '',
    taxIdentifier: settings.taxIdentifier ?? '',
    currency: settings.currency,
    defaultTaxRate: settings.defaultTaxRate,
    invoiceDueDays: settings.invoiceDueDays,
    contractExpiryWarningDays: settings.contractExpiryWarningDays,
    invoiceDueWarningDays: settings.invoiceDueWarningDays,
  };
}

function SchedulerCard() {
  const t = useTranslations('admin');
  const queryClient = useQueryClient();
  const showError = useErrorToast();
  const mutation = useMutation({
    mutationFn: systemService.runReminders,
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      toast.success(
        t('runResult', {
          hearings: result.hearingReminders,
          contracts: result.contractAlerts,
          invoices: result.invoiceAlerts,
        }),
      );
    },
    onError: showError,
  });

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle className="flex items-center gap-2">
            <BellRing className="text-gold size-4" aria-hidden />
            {t('scheduler')}
          </CardTitle>
          <CardDescription className="mt-1">{t('schedulerText')}</CardDescription>
        </div>
        <Button variant="outline" loading={mutation.isPending} onClick={() => mutation.mutate()}>
          <Play /> {t('runNow')}
        </Button>
      </CardHeader>
    </Card>
  );
}

function AdminSettingsView() {
  const t = useTranslations('admin');
  const { data, isLoading, error, refetch } = useSettings();
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader title={t('settingsTitle')} description={t('settingsSubtitle')} />
      {isLoading ? (
        <PageSkeleton />
      ) : error || !data ? (
        <ErrorState error={error} onRetry={() => refetch()} />
      ) : (
        <SettingsForm settings={data} />
      )}
      <SchedulerCard />
    </div>
  );
}

export default function AdminSettingsPage() {
  return (
    <RoleGate roles={['ADMIN']}>
      <AdminSettingsView />
    </RoleGate>
  );
}
