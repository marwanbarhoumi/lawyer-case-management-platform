'use client';

import { useRouter } from 'next/navigation';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { z } from 'zod';
import { useAuth } from '@/components/providers/auth-provider';
import { RoleBadge } from '@/components/shared/status-badges';
import { FormField } from '@/components/shared/form-field';
import { SearchSelect } from '@/components/shared/search-select';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input, NativeSelect, Textarea } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { useErrorToast } from '@/hooks/use-error-message';
import { toDateInput } from '@/lib/dates';
import { loadClientOptions, userOptionsLoader } from '@/lib/option-loaders';
import { fullName } from '@/lib/utils';
import { nullable, optionalString, requiredString } from '@/lib/validation';
import { casesService, usersService, type CaseInput } from '@/services/resources';
import {
  CASE_PRIORITIES,
  CASE_STATUSES,
  CASE_TYPES,
  type CaseDetail,
  type PersonRef,
} from '@/types/api';

const schema = z.object({
  title: requiredString(200),
  referenceNumber: z
    .string()
    .trim()
    .max(50, 'maxLength')
    .regex(/^[A-Za-z0-9/_.-]*$/, 'reference'),
  clientId: z.string({ message: 'required' }).min(1, 'required'),
  caseType: z.enum(CASE_TYPES),
  status: z.enum(CASE_STATUSES),
  priority: z.enum(CASE_PRIORITIES),
  lawyerId: z.string().nullable(),
  court: optionalString(200),
  judge: optionalString(200),
  opposingParty: optionalString(300),
  openingDate: z.string(),
  closingDate: z.string(),
  description: optionalString(10000),
  assistantIds: z.array(z.string()),
});

type FormValues = z.infer<typeof schema>;

const loadLawyers = userOptionsLoader(['LAWYER', 'ADMIN']);

function TeamPicker({
  value,
  onChange,
  excludeId,
}: {
  value: string[];
  onChange: (ids: string[]) => void;
  excludeId?: string | null;
}) {
  const common = useTranslations('common');
  const { data, isLoading } = useQuery({
    queryKey: ['users', 'lookup', 'team'],
    queryFn: () => usersService.lookup(['ASSISTANT', 'LAWYER']),
    staleTime: 60_000,
  });
  if (isLoading) return <Skeleton className="h-24 w-full" />;
  const members = (data ?? []).filter((member) => member.id !== excludeId);
  if (members.length === 0)
    return <p className="text-muted-foreground text-sm">{common('none')}</p>;

  return (
    <ul className="grid max-h-56 gap-1 overflow-y-auto rounded-md border p-2 sm:grid-cols-2">
      {members.map((member) => {
        const checked = value.includes(member.id);
        return (
          <li key={member.id}>
            <label className="hover:bg-muted flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm">
              <input
                type="checkbox"
                className="size-4 accent-[var(--navy)]"
                checked={checked}
                onChange={() =>
                  onChange(checked ? value.filter((id) => id !== member.id) : [...value, member.id])
                }
              />
              <span className="min-w-0 flex-1 truncate">{fullName(member)}</span>
              <RoleBadge role={member.role} />
            </label>
          </li>
        );
      })}
    </ul>
  );
}

export function CaseForm({
  initial,
  initialClient,
}: {
  initial?: CaseDetail;
  initialClient?: PersonRef;
}) {
  const t = useTranslations('cases');
  const common = useTranslations('common');
  const enums = useTranslations('enums');
  const { hasRole } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const showError = useErrorToast();
  const isAdmin = hasRole('ADMIN');
  const client = initial?.client ?? initialClient;

  const {
    register,
    control,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: initial?.title ?? '',
      referenceNumber: initial?.referenceNumber ?? '',
      clientId: client?.id ?? '',
      caseType: initial?.caseType ?? 'CIVIL',
      status: initial?.status ?? 'OPEN',
      priority: initial?.priority ?? 'MEDIUM',
      lawyerId: initial?.lawyerId ?? null,
      court: initial?.court ?? '',
      judge: initial?.judge ?? '',
      opposingParty: initial?.opposingParty ?? '',
      openingDate: toDateInput(initial?.openingDate),
      closingDate: toDateInput(initial?.closingDate),
      description: initial?.description ?? '',
      assistantIds: initial?.assistants.map((member) => member.id) ?? [],
    },
  });
  const status = watch('status');
  const lawyerId = watch('lawyerId');

  const mutation = useMutation({
    mutationFn: (input: CaseInput) =>
      initial ? casesService.update(initial.id, input) : casesService.create(input),
    onSuccess: (saved) => {
      queryClient.invalidateQueries({ queryKey: ['cases'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      toast.success(initial ? common('saved') : common('created'));
      router.push(`/dashboard/cases/${saved.id}`);
    },
    onError: showError,
  });

  const onSubmit = handleSubmit((values) => {
    const input: CaseInput = {
      title: values.title,
      caseType: values.caseType,
      status: values.status,
      priority: values.priority,
      clientId: values.clientId,
      court: nullable(values.court),
      judge: nullable(values.judge),
      opposingParty: nullable(values.opposingParty),
      description: nullable(values.description),
      openingDate: values.openingDate || undefined,
      assistantIds: values.assistantIds,
    };
    if (!initial && values.referenceNumber.trim())
      input.referenceNumber = values.referenceNumber.trim();
    if (initial && values.status === 'CLOSED') input.closingDate = values.closingDate || null;
    if (isAdmin && values.lawyerId) input.lawyerId = values.lawyerId;
    mutation.mutate(input);
  });

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{common('details')}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-5 sm:grid-cols-2">
          <FormField label={t('caseTitle')} error={errors.title} className="sm:col-span-2">
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
                  onChange={(value) => field.onChange(value ?? '')}
                  loadOptions={loadClientOptions}
                  selectedLabel={client ? fullName(client) : undefined}
                  disabled={Boolean(initial)}
                />
              )}
            />
          </FormField>
          {initial ? (
            <FormField label={t('reference')}>
              <Input value={initial.referenceNumber} readOnly disabled dir="ltr" />
            </FormField>
          ) : (
            <FormField
              label={t('reference')}
              hint={t('referenceHint')}
              error={errors.referenceNumber}
              optional
            >
              <Input dir="ltr" className="uppercase" {...register('referenceNumber')} />
            </FormField>
          )}
          <FormField label={t('type')} error={errors.caseType}>
            <NativeSelect {...register('caseType')}>
              {CASE_TYPES.map((value) => (
                <option key={value} value={value}>
                  {enums(`caseType.${value}`)}
                </option>
              ))}
            </NativeSelect>
          </FormField>
          <div className="grid grid-cols-2 gap-4">
            <FormField label={t('status')} error={errors.status}>
              <NativeSelect {...register('status')}>
                {CASE_STATUSES.map((value) => (
                  <option key={value} value={value}>
                    {enums(`caseStatus.${value}`)}
                  </option>
                ))}
              </NativeSelect>
            </FormField>
            <FormField label={t('priority')} error={errors.priority}>
              <NativeSelect {...register('priority')}>
                {CASE_PRIORITIES.map((value) => (
                  <option key={value} value={value}>
                    {enums(`casePriority.${value}`)}
                  </option>
                ))}
              </NativeSelect>
            </FormField>
          </div>
          <FormField label={t('openingDate')} error={errors.openingDate} optional>
            <Input type="date" {...register('openingDate')} />
          </FormField>
          {initial && status === 'CLOSED' && (
            <FormField label={t('closingDate')} error={errors.closingDate} optional>
              <Input type="date" {...register('closingDate')} />
            </FormField>
          )}
          <FormField
            label={t('description')}
            error={errors.description}
            optional
            className="sm:col-span-2"
          >
            <Textarea rows={4} {...register('description')} />
          </FormField>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('courtInfo')}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-5 sm:grid-cols-2">
          <FormField label={t('court')} error={errors.court} optional>
            <Input {...register('court')} />
          </FormField>
          <FormField label={t('judge')} error={errors.judge} optional>
            <Input {...register('judge')} />
          </FormField>
          <FormField
            label={t('opposingParty')}
            error={errors.opposingParty}
            optional
            className="sm:col-span-2"
          >
            <Input {...register('opposingParty')} />
          </FormField>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('team')}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-5">
          {isAdmin && (
            <FormField label={t('lawyer')} error={errors.lawyerId} optional>
              <Controller
                control={control}
                name="lawyerId"
                render={({ field }) => (
                  <SearchSelect
                    queryKey="lawyers"
                    value={field.value}
                    onChange={(value) => field.onChange(value)}
                    loadOptions={loadLawyers}
                    selectedLabel={initial ? fullName(initial.lawyer) : undefined}
                  />
                )}
              />
            </FormField>
          )}
          <div className="grid gap-1.5">
            <p className="text-sm font-medium">{t('assistants')}</p>
            <p className="text-muted-foreground text-xs">{t('assistantsHint')}</p>
            <Controller
              control={control}
              name="assistantIds"
              render={({ field }) => (
                <TeamPicker
                  value={field.value}
                  onChange={field.onChange}
                  excludeId={lawyerId ?? initial?.lawyerId}
                />
              )}
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={() => router.back()}>
          {common('cancel')}
        </Button>
        <Button type="submit" loading={mutation.isPending}>
          {mutation.isPending ? common('saving') : common('save')}
        </Button>
      </div>
    </form>
  );
}
