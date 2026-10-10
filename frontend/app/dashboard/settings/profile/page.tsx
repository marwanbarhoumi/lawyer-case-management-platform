'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { z } from 'zod';
import { useAuth, useCurrentUser } from '@/components/providers/auth-provider';
import { FormField } from '@/components/shared/form-field';
import { PageHeader } from '@/components/shared/page-header';
import { RoleBadge } from '@/components/shared/status-badges';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useErrorToast } from '@/hooks/use-error-message';
import { useFormat } from '@/hooks/use-format';
import { fullName, initials } from '@/lib/utils';
import { nullable, phoneSchema, requiredString } from '@/lib/validation';
import { authService } from '@/services/auth.service';

const schema = z.object({
  firstName: requiredString(100),
  lastName: requiredString(100),
  phone: phoneSchema,
});
type FormValues = z.infer<typeof schema>;

export default function ProfilePage() {
  const t = useTranslations('settings');
  const auth = useTranslations('auth');
  const common = useTranslations('common');
  const user = useCurrentUser();
  const { setUser } = useAuth();
  const format = useFormat();
  const showError = useErrorToast();
  const {
    register,
    handleSubmit,
    formState: { errors, isDirty },
    reset,
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { firstName: user.firstName, lastName: user.lastName, phone: user.phone ?? '' },
  });

  const mutation = useMutation({
    mutationFn: (values: FormValues) =>
      authService.updateProfile({ ...values, phone: nullable(values.phone) }),
    onSuccess: (updated) => {
      setUser(updated);
      reset({
        firstName: updated.firstName,
        lastName: updated.lastName,
        phone: updated.phone ?? '',
      });
      toast.success(t('profileSaved'));
    },
    onError: showError,
  });

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader title={t('profile')} description={t('profileDescription')} />
      <Card>
        <CardContent className="flex flex-wrap items-center gap-4">
          <Avatar className="size-14 text-lg">
            <AvatarFallback>{initials(user)}</AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <p className="text-lg font-semibold">{fullName(user)}</p>
            <p className="text-muted-foreground text-sm" dir="ltr">
              {user.email}
            </p>
            <p className="text-muted-foreground text-xs">
              {t('memberSince', { date: format.date(user.createdAt) })}
            </p>
          </div>
          <RoleBadge role={user.role} />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>{common('details')}</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={handleSubmit((values) => mutation.mutate(values))}
            noValidate
            className="grid gap-5 sm:grid-cols-2"
          >
            <FormField label={auth('firstName')} error={errors.firstName}>
              <Input autoComplete="given-name" {...register('firstName')} />
            </FormField>
            <FormField label={auth('lastName')} error={errors.lastName}>
              <Input autoComplete="family-name" {...register('lastName')} />
            </FormField>
            <FormField label={auth('email')}>
              <Input value={user.email} readOnly disabled dir="ltr" />
            </FormField>
            <FormField label={auth('phone')} error={errors.phone} optional>
              <Input type="tel" autoComplete="tel" dir="ltr" {...register('phone')} />
            </FormField>
            <div className="flex justify-end sm:col-span-2">
              <Button type="submit" loading={mutation.isPending} disabled={!isDirty}>
                {mutation.isPending ? common('saving') : common('save')}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
