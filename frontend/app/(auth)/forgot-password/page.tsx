'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslations } from 'next-intl';
import { z } from 'zod';
import { MailCheck } from 'lucide-react';
import { FormField } from '@/components/shared/form-field';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useErrorToast } from '@/hooks/use-error-message';
import { emailSchema } from '@/lib/validation';
import { authService } from '@/services/auth.service';

const schema = z.object({ email: emailSchema });

export default function ForgotPasswordPage() {
  const t = useTranslations('auth');
  const showError = useErrorToast();
  const [sent, setSent] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { email: '' },
  });

  const onSubmit = handleSubmit(async ({ email }) => {
    try {
      await authService.forgotPassword(email);
      setSent(true);
    } catch (error) {
      showError(error);
    }
  });

  return (
    <>
      <h1 className="text-2xl font-semibold">{t('forgotTitle')}</h1>
      <p className="text-muted-foreground mt-1 text-sm">{t('forgotSubtitle')}</p>
      {sent ? (
        <p
          role="status"
          className="mt-6 flex items-start gap-2 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800"
        >
          <MailCheck className="mt-0.5 size-4 shrink-0" aria-hidden />
          {t('resetSent')}
        </p>
      ) : (
        <form onSubmit={onSubmit} className="mt-6 grid gap-4" noValidate>
          <FormField label={t('email')} error={errors.email}>
            <Input type="email" autoComplete="email" {...register('email')} />
          </FormField>
          <Button type="submit" loading={isSubmitting} className="w-full">
            {t('sendLink')}
          </Button>
        </form>
      )}
      <p className="mt-6 text-center text-sm">
        <Link href="/login" className="text-primary font-medium underline-offset-4 hover:underline">
          {t('backToLogin')}
        </Link>
      </p>
    </>
  );
}
