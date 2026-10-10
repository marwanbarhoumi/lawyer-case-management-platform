'use client';

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
import { APP_TIMEZONE } from '@/i18n/config';
import { isoToZonedInputs, todayInput, zonedDateTimeToIso } from '@/lib/dates';
import { caseOptionsLoader } from '@/lib/option-loaders';
import { nullable, optionalString, timeSchema } from '@/lib/validation';
import { hearingsService, type HearingInput } from '@/services/resources';
import { HEARING_STATUSES, HEARING_TYPES, type Hearing } from '@/types/api';

const schema = z.object({
  caseId: z.string().min(1, 'required'),
  date: z.string().min(1, 'required'),
  time: timeSchema,
  type: z.enum(HEARING_TYPES),
  status: z.enum(HEARING_STATUSES),
  court: optionalString(200),
  location: optionalString(300),
  notes: optionalString(5000),
});

type FormValues = z.infer<typeof schema>;

const loadOpenCases = caseOptionsLoader(null, true);

interface HearingFormProps {
  hearing?: Hearing;
  initialCase?: { id: string; label: string };
  onSaved: (hearing: Hearing) => void;
  onCancel: () => void;
}

export function HearingForm({ hearing, initialCase, onSaved, onCancel }: HearingFormProps) {
  const t = useTranslations('hearings');
  const common = useTranslations('common');
  const enums = useTranslations('enums');
  const queryClient = useQueryClient();
  const showError = useErrorToast();
  const zoned = hearing ? isoToZonedInputs(hearing.date) : null;

  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      caseId: hearing?.caseId ?? initialCase?.id ?? '',
      date: zoned?.date ?? todayInput(1),
      time: zoned?.time ?? hearing?.time ?? '09:00',
      type: hearing?.type ?? 'PROCEDURAL',
      status: hearing?.status ?? 'SCHEDULED',
      court: hearing?.court ?? '',
      location: hearing?.location ?? '',
      notes: hearing?.notes ?? '',
    },
  });

  const mutation = useMutation({
    mutationFn: (values: FormValues) => {
      const payload: Omit<HearingInput, 'caseId'> = {
        date: zonedDateTimeToIso(values.date, values.time),
        time: values.time,
        type: values.type,
        status: values.status,
        court: nullable(values.court),
        location: nullable(values.location),
        notes: nullable(values.notes),
      };
      return hearing
        ? hearingsService.update(hearing.id, payload)
        : hearingsService.create({ ...payload, caseId: values.caseId });
    },
    onSuccess: (saved) => {
      queryClient.invalidateQueries({ queryKey: ['hearings'] });
      queryClient.invalidateQueries({ queryKey: ['cases'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      toast.success(hearing ? common('saved') : common('created'));
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
      <FormField label={t('case')} error={errors.caseId} className="sm:col-span-2">
        <Controller
          control={control}
          name="caseId"
          render={({ field }) => (
            <SearchSelect
              queryKey="open-cases"
              value={field.value}
              onChange={(value) => field.onChange(value ?? '')}
              loadOptions={loadOpenCases}
              selectedLabel={
                hearing
                  ? `${hearing.case.referenceNumber} — ${hearing.case.title}`
                  : initialCase?.label
              }
              disabled={Boolean(hearing)}
            />
          )}
        />
      </FormField>
      <FormField label={t('date')} error={errors.date}>
        <Input type="date" {...register('date')} />
      </FormField>
      <FormField
        label={t('time')}
        error={errors.time}
        hint={t('timezoneHint', { timezone: APP_TIMEZONE })}
      >
        <Input type="time" step={300} dir="ltr" {...register('time')} />
      </FormField>
      <FormField label={t('type')} error={errors.type}>
        <NativeSelect {...register('type')}>
          {HEARING_TYPES.map((value) => (
            <option key={value} value={value}>
              {enums(`hearingType.${value}`)}
            </option>
          ))}
        </NativeSelect>
      </FormField>
      {hearing ? (
        <FormField label={t('status')} error={errors.status}>
          <NativeSelect {...register('status')}>
            {HEARING_STATUSES.map((value) => (
              <option key={value} value={value}>
                {enums(`hearingStatus.${value}`)}
              </option>
            ))}
          </NativeSelect>
        </FormField>
      ) : (
        <div className="hidden sm:block" />
      )}
      <FormField label={t('court')} hint={t('courtHint')} error={errors.court} optional>
        <Input {...register('court')} />
      </FormField>
      <FormField label={t('location')} error={errors.location} optional>
        <Input {...register('location')} />
      </FormField>
      <FormField label={t('notes')} error={errors.notes} optional className="sm:col-span-2">
        <Textarea rows={4} {...register('notes')} />
      </FormField>
      <div className="flex justify-end gap-2 sm:col-span-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          {common('cancel')}
        </Button>
        <Button type="submit" loading={mutation.isPending}>
          {mutation.isPending ? common('saving') : common('save')}
        </Button>
      </div>
    </form>
  );
}
