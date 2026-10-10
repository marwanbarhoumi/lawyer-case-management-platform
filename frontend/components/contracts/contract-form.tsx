'use client';

import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { z } from 'zod';
import { FormField } from '@/components/shared/form-field';
import { SearchSelect } from '@/components/shared/search-select';
import { Button } from '@/components/ui/button';
import { Input, NativeSelect, Textarea } from '@/components/ui/input';
import { useErrorToast } from '@/hooks/use-error-message';
import { toDateInput, todayInput } from '@/lib/dates';
import { ACCEPTED_EXTENSIONS, MAX_UPLOAD_MB, isAcceptedFile } from '@/lib/files';
import { caseOptionsLoader, loadClientOptions } from '@/lib/option-loaders';
import { fullName } from '@/lib/utils';
import { nullable, optionalString, requiredString } from '@/lib/validation';
import { contractsService, documentsService, type ContractInput } from '@/services/resources';
import { CONTRACT_STATUSES, type Contract, type PersonRef } from '@/types/api';

const schema = z
  .object({
    clientId: z.string().min(1, 'required'),
    caseId: z.string().nullable(),
    title: requiredString(200),
    status: z.enum(CONTRACT_STATUSES),
    startDate: z.string().min(1, 'required'),
    endDate: z.string(),
    value: z.string().regex(/^(\d+([.,]\d{1,2})?)?$/, 'nonNegative'),
    description: optionalString(10000),
  })
  .refine((value) => !value.endDate || value.endDate >= value.startDate, {
    message: 'endAfterStart',
    path: ['endDate'],
  });

type FormValues = z.infer<typeof schema>;

interface ContractFormProps {
  contract?: Contract;
  initialClient?: PersonRef;
  initialCase?: { id: string; label: string };
  onSaved: (contract: Contract) => void;
  onCancel: () => void;
}

export function ContractForm({
  contract,
  initialClient,
  initialCase,
  onSaved,
  onCancel,
}: ContractFormProps) {
  const t = useTranslations('contracts');
  const common = useTranslations('common');
  const validation = useTranslations('validation');
  const enums = useTranslations('enums.contractStatus');
  const queryClient = useQueryClient();
  const showError = useErrorToast();
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const client = contract?.client ?? initialClient;

  const {
    register,
    control,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      clientId: client?.id ?? '',
      caseId: contract?.caseId ?? initialCase?.id ?? null,
      title: contract?.title ?? '',
      status: contract?.status ?? 'ACTIVE',
      startDate: contract ? toDateInput(contract.startDate) : todayInput(),
      endDate: toDateInput(contract?.endDate),
      value: contract?.value ? String(Number(contract.value)) : '',
      description: contract?.description ?? '',
    },
  });
  const clientId = watch('clientId');

  const mutation = useMutation({
    mutationFn: async (values: FormValues) => {
      let documentId = contract?.documentId ?? null;
      if (file) {
        const form = new FormData();
        form.append('file', file);
        form.append('type', 'CONTRACT');
        form.append('name', `${values.title}`);
        form.append('clientId', values.clientId);
        if (values.caseId) form.append('caseId', values.caseId);
        documentId = (await documentsService.upload(form)).id;
      }
      const input: ContractInput = {
        clientId: values.clientId,
        caseId: values.caseId,
        documentId,
        title: values.title,
        status: values.status,
        startDate: values.startDate,
        endDate: values.endDate || null,
        value: values.value ? Number(values.value.replace(',', '.')) : null,
        description: nullable(values.description),
      };
      return contract
        ? contractsService.update(contract.id, input)
        : contractsService.create(input);
    },
    onSuccess: (saved) => {
      queryClient.invalidateQueries({ queryKey: ['contracts'] });
      queryClient.invalidateQueries({ queryKey: ['documents'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      toast.success(contract ? common('saved') : common('created'));
      onSaved(saved);
    },
    onError: showError,
  });

  return (
    <form
      onSubmit={handleSubmit((values) => mutation.mutate(values))}
      noValidate
      className="grid gap-5 sm:grid-cols-2"
    >
      <FormField label={t('contractTitle')} error={errors.title} className="sm:col-span-2">
        <Input {...register('title')} />
      </FormField>
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
                contract?.case
                  ? `${contract.case.referenceNumber} — ${contract.case.title}`
                  : initialCase?.label
              }
              disabled={!clientId}
              clearable
            />
          )}
        />
      </FormField>
      <FormField label={t('startDate')} error={errors.startDate}>
        <Input type="date" {...register('startDate')} />
      </FormField>
      <FormField label={t('endDate')} error={errors.endDate} hint={t('noEndDate')} optional>
        <Input type="date" {...register('endDate')} />
      </FormField>
      <FormField label={t('status')} error={errors.status}>
        <NativeSelect {...register('status')}>
          {CONTRACT_STATUSES.map((value) => (
            <option key={value} value={value}>
              {enums(value)}
            </option>
          ))}
        </NativeSelect>
      </FormField>
      <FormField label={t('value')} error={errors.value} optional>
        <Input inputMode="decimal" dir="ltr" {...register('value')} />
      </FormField>
      <FormField
        label={t('description')}
        error={errors.description}
        optional
        className="sm:col-span-2"
      >
        <Textarea rows={4} {...register('description')} />
      </FormField>
      <FormField
        label={t('document')}
        hint={
          contract?.document
            ? t('currentDocument', { name: contract.document.name })
            : t('attachHint')
        }
        error={fileError ? { message: fileError } : undefined}
        optional
        className="sm:col-span-2"
      >
        <Input
          type="file"
          accept={ACCEPTED_EXTENSIONS.join(',')}
          className="cursor-pointer file:me-3"
          onChange={(event) => {
            const selected = event.target.files?.[0] ?? null;
            if (selected && !isAcceptedFile(selected)) {
              setFileError(validation('invalidFileType'));
              setFile(null);
            } else if (selected && selected.size > MAX_UPLOAD_MB * 1024 * 1024) {
              setFileError(validation('fileTooLarge'));
              setFile(null);
            } else {
              setFileError(null);
              setFile(selected);
            }
          }}
        />
      </FormField>
      <div className="flex justify-end gap-2 sm:col-span-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          {common('cancel')}
        </Button>
        <Button type="submit" loading={mutation.isPending} disabled={Boolean(fileError)}>
          {mutation.isPending ? common('saving') : common('save')}
        </Button>
      </div>
    </form>
  );
}
