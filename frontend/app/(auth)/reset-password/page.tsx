'use client';

import { Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { z } from 'zod';
import { FormField } from '@/components/shared/form-field';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useErrorToast } from '@/hooks/use-error-message';
import { passwordSchema } from '@/lib/validation';
import { authService } from '@/services/auth.service';

const schema = z
  .object({ password: passwordSchema, confirmPassword: z.string() })
  .refine((value) => value.password === value.confirmPassword, {
    message: 'passwordsMatch',
    path: ['confirmPassword'],
  });

function ResetForm() {
  const t = useTranslations('auth');
  const showError = useErrorToast();
  const router = useRouter();
  const token = useSearchParams().get('token');
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { password: '', confirmPassword: '' },
  });

  const onSubmit = handleSubmit(async ({ password }) => {
    if (!token) return;
    try {
      await authService.resetPassword(token, password);
      toast.success(t('resetSuccess'));
      router.replace('/login');
    } catch (error) {
      showError(error);
    }
  });

  if (!token) {
    return (
      <p
        role="alert"
        className="border-destructive/30 bg-destructive/5 text-destructive mt-6 rounded-md border p-3 text-sm"
      >
        {t('missingToken')}
      </p>
    );
  }

  return (
    <form onSubmit={onSubmit} className="mt-6 grid gap-4" noValidate>
      <FormField label={t('newPassword')} error={errors.password} hint={t('passwordHint')}>
        <Input type="password" autoComplete="new-password" {...register('password')} />
      </FormField>
      <FormField label={t('confirmPassword')} error={errors.confirmPassword}>
        <Input type="password" autoComplete="new-password" {...register('confirmPassword')} />
      </FormField>
      <Button type="submit" loading={isSubmitting} className="w-full">
        {t('resetPassword')}
      </Button>
    </form>
  );
}

export default function ResetPasswordPage() {
  const t = useTranslations('auth');
  return (
    <>
      <h1 className="text-2xl font-semibold">{t('resetTitle')}</h1>
      <p className="text-muted-foreground mt-1 text-sm">{t('resetSubtitle')}</p>
      <Suspense>
        <ResetForm />
      </Suspense>
      <p className="mt-6 text-center text-sm">
        <Link href="/login" className="text-primary font-medium underline-offset-4 hover:underline">
          {t('backToLogin')}
        </Link>
      </p>
    </>
  );
}
