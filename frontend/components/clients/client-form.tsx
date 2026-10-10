'use client';

import { useRouter } from 'next/navigation';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { z } from 'zod';
import { useAuth } from '@/components/providers/auth-provider';
import { FormField } from '@/components/shared/form-field';
import { SearchSelect } from '@/components/shared/search-select';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input, Textarea } from '@/components/ui/input';
import { useErrorToast } from '@/hooks/use-error-message';
import { userOptionsLoader } from '@/lib/option-loaders';
import { fullName } from '@/lib/utils';
import {
  nullable,
  optionalEmail,
  optionalString,
  phoneSchema,
  requiredString,
} from '@/lib/validation';
import { clientsService, type ClientInput } from '@/services/resources';
import type { Client } from '@/types/api';

const schema = z.object({
  firstName: requiredString(100),
  lastName: requiredString(100),
  email: optionalEmail,
  phone: phoneSchema,
  nationalId: optionalString(50),
  address: optionalString(300),
  notes: optionalString(5000),
  lawyerId: z.string().nullable(),
});

type FormValues = z.infer<typeof schema>;

const loadLawyers = userOptionsLoader(['LAWYER', 'ADMIN']);

export function ClientForm({ client }: { client?: Client }) {
  const t = useTranslations('clients');
  const common = useTranslations('common');
  const { hasRole } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const showError = useErrorToast();

  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      firstName: client?.firstName ?? '',
      lastName: client?.lastName ?? '',
      email: client?.email ?? '',
      phone: client?.phone ?? '',
      nationalId: client?.nationalId ?? '',
      address: client?.address ?? '',
      notes: client?.notes ?? '',
      lawyerId: client?.lawyerId ?? null,
    },
  });

  const mutation = useMutation({
    mutationFn: (input: ClientInput) =>
      client ? clientsService.update(client.id, input) : clientsService.create(input),
    onSuccess: (saved) => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      toast.success(client ? common('saved') : common('created'));
      router.push(`/dashboard/clients/${saved.id}`);
    },
    onError: showError,
  });

  const onSubmit = handleSubmit((values) => {
    const input: ClientInput = {
      firstName: values.firstName,
      lastName: values.lastName,
      email: nullable(values.email),
      phone: nullable(values.phone),
      nationalId: nullable(values.nationalId),
      address: nullable(values.address),
      notes: nullable(values.notes),
    };
    if (hasRole('ADMIN')) input.lawyerId = values.lawyerId;
    mutation.mutate(input);
  });

  return (
    <form onSubmit={onSubmit} noValidate>
      <Card>
        <CardContent className="grid gap-5 sm:grid-cols-2">
          <FormField label={t('firstName')} error={errors.firstName}>
            <Input autoComplete="off" {...register('firstName')} />
          </FormField>
          <FormField label={t('lastName')} error={errors.lastName}>
            <Input autoComplete="off" {...register('lastName')} />
          </FormField>
          <FormField label={common('email')} error={errors.email} optional>
            <Input type="email" dir="ltr" {...register('email')} />
          </FormField>
          <FormField label={common('phone')} error={errors.phone} optional>
            <Input type="tel" dir="ltr" {...register('phone')} />
          </FormField>
          <FormField label={t('nationalId')} error={errors.nationalId} optional>
            <Input dir="ltr" {...register('nationalId')} />
          </FormField>
          {hasRole('ADMIN') && (
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
                    selectedLabel={client?.lawyer ? fullName(client.lawyer) : undefined}
                    placeholder={t('noLawyer')}
                    clearable
                  />
                )}
              />
            </FormField>
          )}
          <FormField
            label={common('address')}
            error={errors.address}
            optional
            className="sm:col-span-2"
          >
            <Input {...register('address')} />
          </FormField>
          <FormField label={t('notes')} error={errors.notes} optional className="sm:col-span-2">
            <Textarea rows={4} {...register('notes')} />
          </FormField>
        </CardContent>
      </Card>
      <div className="mt-6 flex justify-end gap-2">
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
