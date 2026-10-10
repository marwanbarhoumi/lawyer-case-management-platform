'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { MonitorSmartphone } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { z } from 'zod';
import { FormField } from '@/components/shared/form-field';
import { PageHeader } from '@/components/shared/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useErrorToast } from '@/hooks/use-error-message';
import { passwordSchema } from '@/lib/validation';
import { authService } from '@/services/auth.service';

const schema = z
  .object({
    currentPassword: z.string().min(1, 'required'),
    newPassword: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((value) => value.newPassword === value.confirmPassword, {
    message: 'passwordsMatch',
    path: ['confirmPassword'],
  });
type FormValues = z.infer<typeof schema>;

export default function SecurityPage() {
  const t = useTranslations('settings');
  const auth = useTranslations('auth');
  const showError = useErrorToast();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { currentPassword: '', newPassword: '', confirmPassword: '' },
  });

  const mutation = useMutation({
    mutationFn: ({ currentPassword, newPassword }: FormValues) =>
      authService.changePassword({ currentPassword, newPassword }),
    onSuccess: () => {
      reset();
      toast.success(t('passwordChanged'));
    },
    onError: showError,
  });

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader title={t('security')} description={t('securityDescription')} />
      <Card>
        <CardHeader>
          <CardTitle>{t('changePassword')}</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={handleSubmit((values) => mutation.mutate(values))}
            noValidate
            className="grid max-w-md gap-5"
          >
            <FormField label={t('currentPassword')} error={errors.currentPassword}>
              <Input
                type="password"
                autoComplete="current-password"
                {...register('currentPassword')}
              />
            </FormField>
            <FormField
              label={t('newPassword')}
              error={errors.newPassword}
              hint={auth('passwordHint')}
            >
              <Input type="password" autoComplete="new-password" {...register('newPassword')} />
            </FormField>
            <FormField label={t('confirmPassword')} error={errors.confirmPassword}>
              <Input type="password" autoComplete="new-password" {...register('confirmPassword')} />
            </FormField>
            <div>
              <Button type="submit" loading={mutation.isPending}>
                {t('changePassword')}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MonitorSmartphone className="text-gold size-4" aria-hidden />
            {t('sessions')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">{t('sessionsText')}</p>
        </CardContent>
      </Card>
    </div>
  );
}
