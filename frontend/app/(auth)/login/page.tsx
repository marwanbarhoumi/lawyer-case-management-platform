'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { z } from 'zod';
import { AlertCircle } from 'lucide-react';
import { GuestGuard } from '@/components/auth/guest-guard';
import { useAuth } from '@/components/providers/auth-provider';
import { FormField } from '@/components/shared/form-field';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useErrorMessage } from '@/hooks/use-error-message';
import { safeNextPath } from '@/lib/navigation';
import { emailSchema } from '@/lib/validation';

const schema = z.object({ email: emailSchema, password: z.string().min(1, 'required') });
type FormValues = z.infer<typeof schema>;

function LoginForm() {
  const t = useTranslations('auth');
  const { login, sessionExpired } = useAuth();
  const errorMessage = useErrorMessage();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: '', password: '' },
  });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      const user = await login(values);
      toast.success(t('welcomeBack', { name: user.firstName }));
      router.replace(safeNextPath(searchParams.get('next')));
    } catch (error) {
      setFormError(errorMessage(error));
    }
  });

  return (
    <>
      <h1 className="text-2xl font-semibold">{t('loginTitle')}</h1>
      <p className="text-muted-foreground mt-1 text-sm">{t('loginSubtitle')}</p>
      {(formError || sessionExpired) && (
        <p
          role="alert"
          className="border-destructive/30 bg-destructive/5 text-destructive mt-4 flex items-start gap-2 rounded-md border p-3 text-sm"
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
          {formError ?? t('sessionExpired')}
        </p>
      )}
      <form onSubmit={onSubmit} className="mt-6 grid gap-4" noValidate>
        <FormField label={t('email')} error={errors.email}>
          <Input type="email" autoComplete="email" {...register('email')} />
        </FormField>
        <FormField label={t('password')} error={errors.password}>
          <Input type="password" autoComplete="current-password" {...register('password')} />
        </FormField>
        <div className="flex justify-end">
          <Link
            href="/forgot-password"
            className="text-primary text-sm underline-offset-4 hover:underline"
          >
            {t('forgotPassword')}
          </Link>
        </div>
        <Button type="submit" loading={isSubmitting} className="w-full">
          {isSubmitting ? t('loggingIn') : t('login')}
        </Button>
      </form>
      <p className="text-muted-foreground mt-6 text-center text-sm">
        {t('noAccount')}{' '}
        <Link
          href="/register"
          className="text-primary font-medium underline-offset-4 hover:underline"
        >
          {t('register')}
        </Link>
      </p>
    </>
  );
}

export default function LoginPage() {
  return (
    <GuestGuard>
      <Suspense>
        <LoginForm />
      </Suspense>
    </GuestGuard>
  );
}
