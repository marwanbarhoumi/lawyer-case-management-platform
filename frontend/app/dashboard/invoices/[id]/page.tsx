'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Ban, Banknote, Pencil, Printer, Send, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { z } from 'zod';
import { RoleGate } from '@/components/auth/role-gate';
import { InvoiceForm } from '@/components/invoices/invoice-form';
import { Brand } from '@/components/layout/brand';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { FormField } from '@/components/shared/form-field';
import { PageHeader } from '@/components/shared/page-header';
import { ErrorState, PageSkeleton } from '@/components/shared/states';
import { InvoiceStatusBadge } from '@/components/shared/status-badges';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useErrorToast } from '@/hooks/use-error-message';
import { useFormat, useSettings } from '@/hooks/use-format';
import { todayInput } from '@/lib/dates';
import { fullName } from '@/lib/utils';
import { invoicesService } from '@/services/resources';
import type { Invoice } from '@/types/api';

function PaymentDialog({ invoice, onPaid }: { invoice: Invoice; onPaid: () => void }) {
  const t = useTranslations('invoices');
  const common = useTranslations('common');
  const [open, setOpen] = useState(false);
  const showError = useErrorToast();
  const schema = z.object({
    amount: z
      .number({ message: 'required' })
      .refine((value) => value > 0, 'positive')
      .refine((value) => value <= invoice.balance + 0.001, 'overpayment'),
    paidAt: z.string().min(1, 'required'),
  });
  type Values = z.infer<typeof schema>;
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    values: { amount: invoice.balance, paidAt: todayInput() },
  });
  const mutation = useMutation({
    mutationFn: (values: Values) => invoicesService.pay(invoice.id, values),
    onSuccess: () => {
      toast.success(t('paymentRecorded'));
      setOpen(false);
      onPaid();
    },
    onError: showError,
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="gold">
          <Banknote /> {t('recordPayment')}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('recordPayment')}</DialogTitle>
          <DialogDescription>{t('paymentHint')}</DialogDescription>
        </DialogHeader>
        <form
          onSubmit={handleSubmit((values) => mutation.mutate(values))}
          className="grid gap-4"
          noValidate
        >
          <FormField label={t('paymentAmount')} error={errors.amount}>
            <Input
              type="number"
              step="0.01"
              min="0"
              dir="ltr"
              {...register('amount', { valueAsNumber: true })}
            />
          </FormField>
          <FormField label={t('paymentDate')} error={errors.paidAt}>
            <Input type="date" {...register('paidAt')} />
          </FormField>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              {common('cancel')}
            </Button>
            <Button type="submit" loading={mutation.isPending}>
              {common('confirm')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function InvoiceDetail() {
  const t = useTranslations('invoices');
  const common = useTranslations('common');
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const format = useFormat();
  const { data: settings } = useSettings();
  const queryClient = useQueryClient();
  const showError = useErrorToast();
  const [editing, setEditing] = useState(false);
  const {
    data: invoice,
    isLoading,
    error,
    refetch,
  } = useQuery({ queryKey: ['invoices', id], queryFn: () => invoicesService.get(id) });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['invoices'] });
    queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    queryClient.invalidateQueries({ queryKey: ['clients'] });
  };
  const send = useMutation({
    mutationFn: () => invoicesService.update(id, { status: 'SENT' }),
    onSuccess: () => {
      invalidate();
      toast.success(common('saved'));
    },
    onError: showError,
  });
  const cancel = useMutation({
    mutationFn: () => invoicesService.cancel(id),
    onSuccess: () => {
      invalidate();
      toast.success(t('cancelled'));
    },
    onError: showError,
  });
  const remove = useMutation({
    mutationFn: () => invoicesService.remove(id),
    onSuccess: () => {
      invalidate();
      toast.success(common('deleted'));
      router.replace('/dashboard/invoices');
    },
    onError: showError,
  });

  if (isLoading) return <PageSkeleton />;
  if (error || !invoice) return <ErrorState error={error} onRetry={() => refetch()} />;

  const editable =
    ['DRAFT', 'SENT', 'OVERDUE'].includes(invoice.status) && invoice.amountPaid === 0;
  const payable =
    ['SENT', 'PARTIALLY_PAID', 'OVERDUE'].includes(invoice.status) && invoice.balance > 0;

  if (editing) {
    return (
      <div className="mx-auto max-w-5xl">
        <PageHeader title={t('editTitle')} description={invoice.invoiceNumber} />
        <InvoiceForm
          invoice={invoice}
          onSaved={() => {
            setEditing(false);
            invalidate();
          }}
          onCancel={() => setEditing(false)}
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader
        title={
          <span className="flex flex-wrap items-center gap-3">
            <span dir="ltr">{invoice.invoiceNumber}</span>
            <InvoiceStatusBadge status={invoice.status} />
          </span>
        }
        description={
          invoice.paidAt
            ? t('paidAt', { date: format.date(invoice.paidAt) })
            : t('dueOn', { date: format.date(invoice.dueDate) })
        }
        actions={
          <>
            {payable && <PaymentDialog invoice={invoice} onPaid={invalidate} />}
            {invoice.status === 'DRAFT' && (
              <Button loading={send.isPending} onClick={() => send.mutate()}>
                <Send /> {t('markSent')}
              </Button>
            )}
            <Button variant="outline" onClick={() => window.print()}>
              <Printer /> {common('print')}
            </Button>
            {editable && (
              <Button variant="outline" onClick={() => setEditing(true)}>
                <Pencil /> {common('edit')}
              </Button>
            )}
            {invoice.status !== 'PAID' &&
              invoice.status !== 'CANCELLED' &&
              invoice.status !== 'DRAFT' && (
                <ConfirmDialog
                  title={t('cancelTitle')}
                  description={t('cancelDescription')}
                  confirmLabel={t('cancelInvoice')}
                  onConfirm={() => cancel.mutateAsync()}
                  trigger={
                    <Button variant="outline" className="text-destructive">
                      <Ban /> {t('cancelInvoice')}
                    </Button>
                  }
                />
              )}
            {invoice.status === 'DRAFT' && (
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
            )}
          </>
        }
      />
      {!editable && invoice.status !== 'DRAFT' && (
        <p className="no-print text-muted-foreground text-xs">{t('lockedHint')}</p>
      )}

      <article className="print-area bg-card rounded-xl border p-6 shadow-xs sm:p-10">
        <header className="flex flex-col gap-6 border-b pb-6 sm:flex-row sm:justify-between">
          <div className="space-y-1 text-sm">
            <Brand />
            {settings && (
              <div className="text-muted-foreground pt-2">
                <p className="text-foreground font-semibold">{settings.firmName}</p>
                {settings.firmAddress && <p>{settings.firmAddress}</p>}
                {settings.firmPhone && <p dir="ltr">{settings.firmPhone}</p>}
                {settings.firmEmail && <p dir="ltr">{settings.firmEmail}</p>}
                {settings.taxIdentifier && <p>{t('taxId', { value: settings.taxIdentifier })}</p>}
              </div>
            )}
          </div>
          <div className="text-start sm:text-end">
            <p className="font-display text-navy text-3xl font-semibold uppercase">
              {t('invoice')}
            </p>
            <p className="mt-1 font-mono text-sm" dir="ltr">
              {invoice.invoiceNumber}
            </p>
            <p className="text-muted-foreground mt-3 text-sm">
              {t('issuedOn', { date: format.date(invoice.issueDate) })}
            </p>
            <p className="text-muted-foreground text-sm">
              {t('dueOn', { date: format.date(invoice.dueDate) })}
            </p>
          </div>
        </header>

        <section className="grid gap-6 py-6 sm:grid-cols-2">
          <div>
            <p className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
              {t('billTo')}
            </p>
            <Link
              href={`/dashboard/clients/${invoice.client.id}`}
              className="mt-1 block font-semibold hover:underline"
            >
              {fullName(invoice.client)}
            </Link>
            <div className="text-muted-foreground text-sm">
              {invoice.client.address && <p>{invoice.client.address}</p>}
              {invoice.client.phone && <p dir="ltr">{invoice.client.phone}</p>}
              {invoice.client.email && <p dir="ltr">{invoice.client.email}</p>}
            </div>
          </div>
          {invoice.case && (
            <div className="sm:text-end">
              <p className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
                {t('case')}
              </p>
              <Link
                href={`/dashboard/cases/${invoice.case.id}`}
                className="mt-1 block text-sm hover:underline"
              >
                {invoice.case.referenceNumber} — {invoice.case.title}
              </Link>
            </div>
          )}
        </section>

        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>{t('description')}</TableHead>
              <TableHead className="text-end">{t('quantity')}</TableHead>
              <TableHead className="text-end">{t('unitPrice')}</TableHead>
              <TableHead className="text-end">{t('lineTotal')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {invoice.items?.map((item) => (
              <TableRow key={item.id} className="hover:bg-transparent">
                <TableCell className="whitespace-normal">{item.description}</TableCell>
                <TableCell className="text-end tabular-nums">
                  {format.number(item.quantity)}
                </TableCell>
                <TableCell className="text-end tabular-nums">
                  {format.money(item.unitPrice)}
                </TableCell>
                <TableCell className="text-end font-medium tabular-nums">
                  {format.money(item.total)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        <div className="mt-6 flex justify-end">
          <dl className="w-full max-w-xs space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">{t('subtotal')}</dt>
              <dd className="tabular-nums">{format.money(invoice.amount)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">
                {t('tax')} ({format.number(invoice.taxRate)} %)
              </dt>
              <dd className="tabular-nums">{format.money(invoice.tax)}</dd>
            </div>
            <div className="flex justify-between border-t pt-2 text-base font-semibold">
              <dt>{t('total')}</dt>
              <dd className="tabular-nums">{format.money(invoice.total)}</dd>
            </div>
            {invoice.amountPaid > 0 && (
              <div className="flex justify-between text-emerald-700">
                <dt>{t('paid')}</dt>
                <dd className="tabular-nums">− {format.money(invoice.amountPaid)}</dd>
              </div>
            )}
            {invoice.status !== 'CANCELLED' && (
              <div className="bg-navy flex justify-between rounded-md px-3 py-2 font-semibold text-white">
                <dt>{t('balance')}</dt>
                <dd className="tabular-nums">{format.money(invoice.balance)}</dd>
              </div>
            )}
          </dl>
        </div>

        {invoice.notes && (
          <section className="mt-8 border-t pt-4">
            <p className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
              {t('notes')}
            </p>
            <p className="mt-1 text-sm whitespace-pre-line">{invoice.notes}</p>
          </section>
        )}
        <p className="text-muted-foreground mt-10 text-center text-sm italic">{t('thanks')}</p>
      </article>
    </div>
  );
}

export default function InvoiceDetailPage() {
  return (
    <RoleGate roles={['ADMIN', 'LAWYER']}>
      <InvoiceDetail />
    </RoleGate>
  );
}
