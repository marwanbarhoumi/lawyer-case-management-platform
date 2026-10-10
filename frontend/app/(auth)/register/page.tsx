'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { z } from 'zod';
import { GuestGuard } from '@/components/auth/guest-guard';
import { useAuth } from '@/components/providers/auth-provider';
import { FormField } from '@/components/shared/form-field';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useErrorToast } from '@/hooks/use-error-message';
import { emailSchema, passwordSchema, phoneSchema, requiredString } from '@/lib/validation';

const schema = z
  .object({
    firstName: requiredString(100),
    lastName: requiredString(100),
    email: emailSchema,
    phone: phoneSchema,
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((value) => value.password === value.confirmPassword, {
    message: 'passwordsMatch',
    path: ['confirmPassword'],
  });

type FormValues = z.infer<typeof schema>;

export default function RegisterPage() {
  const t = useTranslations('auth');
  const { register: registerAccount } = useAuth();
  const showError = useErrorToast();
  const router = useRouter();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      password: '',
      confirmPassword: '',
    },
  });

  const onSubmit = handleSubmit(async ({ confirmPassword: _confirm, phone, ...values }) => {
    try {
      const user = await registerAccount({ ...values, phone: phone || undefined });
      toast.success(t('welcomeBack', { name: user.firstName }));
      router.replace('/dashboard');
    } catch (error) {
      showError(error);
    }
  });

  return (
    <GuestGuard>
      <h1 className="text-2xl font-semibold">{t('registerTitle')}</h1>
      <p className="text-muted-foreground mt-1 text-sm">{t('registerSubtitle')}</p>
      <form onSubmit={onSubmit} className="mt-6 grid gap-4" noValidate>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label={t('firstName')} error={errors.firstName}>
            <Input autoComplete="given-name" {...register('firstName')} />
          </FormField>
          <FormField label={t('lastName')} error={errors.lastName}>
            <Input autoComplete="family-name" {...register('lastName')} />
          </FormField>
        </div>
        <FormField label={t('email')} error={errors.email}>
          <Input type="email" autoComplete="email" {...register('email')} />
        </FormField>
        <FormField label={t('phone')} error={errors.phone} optional>
          <Input type="tel" autoComplete="tel" dir="ltr" {...register('phone')} />
        </FormField>
        <FormField label={t('password')} error={errors.password} hint={t('passwordHint')}>
          <Input type="password" autoComplete="new-password" {...register('password')} />
        </FormField>
        <FormField label={t('confirmPassword')} error={errors.confirmPassword}>
          <Input type="password" autoComplete="new-password" {...register('confirmPassword')} />
        </FormField>
        <Button type="submit" loading={isSubmitting} className="w-full">
          {isSubmitting ? t('creating') : t('register')}
        </Button>
      </form>
      <p className="text-muted-foreground mt-6 text-center text-sm">
        {t('haveAccount')}{' '}
        <Link href="/login" className="text-primary font-medium underline-offset-4 hover:underline">
          {t('login')}
        </Link>
      </p>
    </GuestGuard>
  );
}
