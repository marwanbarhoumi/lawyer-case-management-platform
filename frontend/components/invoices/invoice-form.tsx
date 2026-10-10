'use client';

import { Controller, useFieldArray, useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Info, Plus, Send, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { z } from 'zod';
import { FormField } from '@/components/shared/form-field';
import { SearchSelect } from '@/components/shared/search-select';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input, Textarea } from '@/components/ui/input';
import { useErrorToast } from '@/hooks/use-error-message';
import { useFormat, useSettings } from '@/hooks/use-format';
import { toDateInput, todayInput } from '@/lib/dates';
import { computeInvoiceTotals } from '@/lib/invoice';
import { caseOptionsLoader, loadClientOptions } from '@/lib/option-loaders';
import { fullName } from '@/lib/utils';
import { nullable, optionalString, requiredString } from '@/lib/validation';
import { invoicesService, type InvoiceInput } from '@/services/resources';
import type { Invoice, PersonRef } from '@/types/api';

const number = (message: string) =>
  z.number({ message: 'required' }).refine(Number.isFinite, message);

const schema = z
  .object({
    clientId: z.string().min(1, 'required'),
    caseId: z.string().nullable(),
    items: z
      .array(
        z.object({
          description: requiredString(500),
          quantity: number('required').refine((value) => value > 0, 'positive'),
          unitPrice: number('required').refine((value) => value >= 0, 'nonNegative'),
        }),
      )
      .min(1, 'itemsRequired'),
    taxRate: number('required').refine((value) => value >= 0 && value <= 100, 'nonNegative'),
    issueDate: z.string().min(1, 'required'),
    dueDate: z.string(),
    notes: optionalString(5000),
  })
  .refine((value) => !value.dueDate || value.dueDate >= value.issueDate, {
    message: 'endAfterStart',
    path: ['dueDate'],
  });

type FormValues = z.infer<typeof schema>;

interface InvoiceFormProps {
  invoice?: Invoice;
  initialClient?: PersonRef;
  initialCase?: { id: string; label: string };
  onSaved: (invoice: Invoice) => void;
  onCancel: () => void;
}

export function InvoiceForm({
  invoice,
  initialClient,
  initialCase,
  onSaved,
  onCancel,
}: InvoiceFormProps) {
  const t = useTranslations('invoices');
  const common = useTranslations('common');
  const validation = useTranslations('validation');
  const format = useFormat();
  const { data: settings } = useSettings();
  const queryClient = useQueryClient();
  const showError = useErrorToast();
  const client = invoice?.client ?? initialClient;

  const {
    register,
    control,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      clientId: client?.id ?? '',
      caseId: invoice?.caseId ?? initialCase?.id ?? null,
      items: invoice?.items?.map(({ description, quantity, unitPrice }) => ({
        description,
        quantity,
        unitPrice,
      })) ?? [{ description: '', quantity: 1, unitPrice: 0 }],
      taxRate: invoice?.taxRate ?? settings?.defaultTaxRate ?? 20,
      issueDate: invoice ? toDateInput(invoice.issueDate) : todayInput(),
      dueDate: invoice ? toDateInput(invoice.dueDate) : '',
      notes: invoice?.notes ?? '',
    },
  });
  const { fields, append, remove } = useFieldArray({ control, name: 'items' });
  const items = useWatch({ control, name: 'items' });
  const taxRate = useWatch({ control, name: 'taxRate' });
  const clientId = useWatch({ control, name: 'clientId' });
  const totals = computeInvoiceTotals(
    (items ?? []).map((item) => ({
      quantity: Number(item?.quantity) || 0,
      unitPrice: Number(item?.unitPrice) || 0,
    })),
    Number(taxRate) || 0,
  );

  const mutation = useMutation({
    mutationFn: ({ values, status }: { values: FormValues; status: 'DRAFT' | 'SENT' }) => {
      const input: Omit<InvoiceInput, 'clientId'> = {
        caseId: values.caseId,
        items: values.items,
        taxRate: values.taxRate,
        issueDate: values.issueDate,
        dueDate: values.dueDate || null,
        notes: nullable(values.notes),
        status,
      };
      return invoice
        ? invoicesService.update(invoice.id, input)
        : invoicesService.create({ ...input, clientId: values.clientId });
    },
    onSuccess: (saved) => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      toast.success(invoice ? common('saved') : common('created'));
      onSaved(saved);
    },
    onError: showError,
  });

  const submit = (status: 'DRAFT' | 'SENT') =>
    handleSubmit((values) => mutation.mutate({ values, status }));
  const keepStatus: 'DRAFT' | 'SENT' = invoice && invoice.status !== 'DRAFT' ? 'SENT' : 'DRAFT';

  return (
    <form onSubmit={submit(keepStatus)} noValidate className="space-y-6">
      <Card>
        <CardContent className="grid gap-5 sm:grid-cols-2">
          <FormField label={t('client')} error={errors.clientId}>
            <Controller
              control={control}
              name="clientId"
              render={({ field }) => (
                <SearchSelect
                  queryKey="clients"
                  value={field.value}
                  onChange={(value) => {
                    field.onChange(value ?? '');
                    setValue('caseId', null);
                  }}
                  loadOptions={loadClientOptions}
                  selectedLabel={client ? fullName(client) : undefined}
                  disabled={Boolean(invoice)}
                />
              )}
            />
          </FormField>
          <FormField label={t('case')} error={errors.caseId} optional>
            <Controller
              control={control}
              name="caseId"
              render={({ field }) => (
                <SearchSelect
                  key={clientId}
                  queryKey={`cases-${clientId}`}
                  value={field.value}
                  onChange={(value) => field.onChange(value)}
                  loadOptions={caseOptionsLoader(clientId || null)}
                  selectedLabel={
                    invoice?.case
                      ? `${invoice.case.referenceNumber} — ${invoice.case.title}`
                      : initialCase?.label
                  }
                  disabled={!clientId}
                  clearable
                />
              )}
            />
          </FormField>
          <FormField label={t('issueDate')} error={errors.issueDate}>
            <Input type="date" {...register('issueDate')} />
          </FormField>
          <FormField label={t('dueDate')} error={errors.dueDate} hint={t('dueDateHint')} optional>
            <Input type="date" {...register('dueDate')} />
          </FormField>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('items')}</CardTitle>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => append({ description: '', quantity: 1, unitPrice: 0 })}
          >
            <Plus /> {t('addItem')}
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="text-muted-foreground hidden grid-cols-[1fr_6rem_9rem_8rem_2.25rem] gap-3 text-xs font-medium uppercase md:grid">
            <span>{t('description')}</span>
            <span>{t('quantity')}</span>
            <span>{t('unitPrice')}</span>
            <span className="text-end">{t('lineTotal')}</span>
            <span />
          </div>
          {fields.map((field, index) => (
            <fieldset
              key={field.id}
              className="grid gap-3 rounded-lg border p-3 md:grid-cols-[1fr_6rem_9rem_8rem_2.25rem] md:items-start md:border-0 md:p-0"
            >
              <legend className="sr-only">
                {t('items')} {index + 1}
              </legend>
              <FormField
                label={t('description')}
                error={errors.items?.[index]?.description}
                className="md:[&>label]:sr-only"
              >
                <Input {...register(`items.${index}.description`)} />
              </FormField>
              <FormField
                label={t('quantity')}
                error={errors.items?.[index]?.quantity}
                className="md:[&>label]:sr-only"
              >
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  dir="ltr"
                  {...register(`items.${index}.quantity`, { valueAsNumber: true })}
                />
              </FormField>
              <FormField
                label={t('unitPrice')}
                error={errors.items?.[index]?.unitPrice}
                className="md:[&>label]:sr-only"
              >
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  dir="ltr"
                  {...register(`items.${index}.unitPrice`, { valueAsNumber: true })}
                />
              </FormField>
              <p className="flex h-9 items-center justify-end text-sm font-medium tabular-nums">
                {format.money(totals.lineTotals[index] ?? 0)}
              </p>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="text-destructive"
                aria-label={`${t('removeItem')} ${index + 1}`}
                disabled={fields.length === 1}
                onClick={() => remove(index)}
              >
                <Trash2 />
              </Button>
            </fieldset>
          ))}
          {(errors.items?.root || errors.items?.message) && (
            <p role="alert" className="text-destructive text-xs font-medium">
              {validation('itemsRequired')}
            </p>
          )}

          <div className="flex flex-col gap-6 border-t pt-4 md:flex-row md:justify-between">
            <FormField label={t('notes')} error={errors.notes} optional className="md:w-1/2">
              <Textarea rows={3} {...register('notes')} />
            </FormField>
            <dl className="space-y-2 text-sm md:w-72">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">{t('subtotal')}</dt>
                <dd className="tabular-nums">{format.money(totals.subtotal)}</dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt>
                  <label htmlFor="invoice-tax-rate" className="text-muted-foreground">
                    {t('taxRate')}
                  </label>
                </dt>
                <dd className="flex items-center gap-3">
                  <Input
                    id="invoice-tax-rate"
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    dir="ltr"
                    className="h-8 w-20"
                    aria-invalid={Boolean(errors.taxRate)}
                    {...register('taxRate', { valueAsNumber: true })}
                  />
                  <span className="tabular-nums">{format.money(totals.tax)}</span>
                </dd>
              </div>
              <div className="flex justify-between border-t pt-2 text-base font-semibold">
                <dt>{t('total')}</dt>
                <dd className="tabular-nums">{format.money(totals.total)}</dd>
              </div>
              <p className="text-muted-foreground flex items-start gap-1.5 text-xs">
                <Info className="mt-0.5 size-3 shrink-0" aria-hidden /> {t('serverComputed')}
              </p>
            </dl>
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-wrap justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          {common('cancel')}
        </Button>
        {(!invoice || invoice.status === 'DRAFT') && (
          <>
            <Button
              type="button"
              variant="secondary"
              loading={mutation.isPending}
              onClick={submit('DRAFT')}
            >
              {t('saveDraft')}
            </Button>
            <Button type="button" loading={mutation.isPending} onClick={submit('SENT')}>
              <Send /> {t('saveAndSend')}
            </Button>
          </>
        )}
        {invoice && invoice.status !== 'DRAFT' && (
          <Button type="submit" loading={mutation.isPending}>
            {common('save')}
          </Button>
        )}
      </div>
    </form>
  );
}
