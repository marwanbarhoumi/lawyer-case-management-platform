'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { z } from 'zod';
import { FormField } from '@/components/shared/form-field';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input, NativeSelect } from '@/components/ui/input';
import { useErrorToast } from '@/hooks/use-error-message';
import {
  emailSchema,
  nullable,
  passwordSchema,
  phoneSchema,
  requiredString,
} from '@/lib/validation';
import { usersService, type UserInput } from '@/services/resources';
import { ROLES, type AdminUser } from '@/types/api';

const baseSchema = z.object({
  firstName: requiredString(100),
  lastName: requiredString(100),
  email: emailSchema,
  phone: phoneSchema,
  role: z.enum(ROLES),
  isActive: z.boolean(),
});
const createSchema = baseSchema.extend({ password: passwordSchema });
const editSchema = baseSchema.extend({ password: z.union([z.literal(''), passwordSchema]) });
type FormValues = z.infer<typeof editSchema>;

/** Create (user = null) or edit a user. Opened when `open` is true. */
export function UserDialog({
  open,
  user,
  onClose,
}: {
  open: boolean;
  user: AdminUser | null;
  onClose: () => void;
}) {
  const t = useTranslations('admin');
  const auth = useTranslations('auth');
  const common = useTranslations('common');
  const enums = useTranslations('enums.role');
  const queryClient = useQueryClient();
  const showError = useErrorToast();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(user ? editSchema : createSchema),
    values: {
      firstName: user?.firstName ?? '',
      lastName: user?.lastName ?? '',
      email: user?.email ?? '',
      phone: user?.phone ?? '',
      role: user?.role ?? 'LAWYER',
      isActive: user?.isActive ?? true,
      password: '',
    },
  });

  const mutation = useMutation({
    mutationFn: async (values: FormValues): Promise<unknown> => {
      const input: UserInput = {
        ...values,
        phone: nullable(values.phone),
        password: values.password || undefined,
      };
      return user
        ? usersService.update(user.id, input)
        : usersService.create({ ...input, password: values.password });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast.success(user ? t('userUpdated') : t('userCreated'));
      onClose();
    },
    onError: showError,
  });

  return (
    <Dialog open={open} onOpenChange={(value) => !value && onClose()}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{user ? t('editUser') : t('newUser')}</DialogTitle>
        </DialogHeader>
        <form
          onSubmit={handleSubmit((values) => mutation.mutate(values))}
          noValidate
          className="grid gap-4 sm:grid-cols-2"
        >
          <FormField label={auth('firstName')} error={errors.firstName}>
            <Input {...register('firstName')} />
          </FormField>
          <FormField label={auth('lastName')} error={errors.lastName}>
            <Input {...register('lastName')} />
          </FormField>
          <FormField label={auth('email')} error={errors.email}>
            <Input type="email" dir="ltr" autoComplete="off" {...register('email')} />
          </FormField>
          <FormField label={auth('phone')} error={errors.phone} optional>
            <Input type="tel" dir="ltr" {...register('phone')} />
          </FormField>
          <FormField label={t('role')} error={errors.role}>
            <NativeSelect {...register('role')}>
              {ROLES.map((role) => (
                <option key={role} value={role}>
                  {enums(role)}
                </option>
              ))}
            </NativeSelect>
          </FormField>
          <label className="flex items-center gap-2 self-end pb-2 text-sm">
            <input
              type="checkbox"
              className="size-4 accent-[var(--navy)]"
              {...register('isActive')}
            />
            {t('active')}
          </label>
          <FormField
            label={user ? t('passwordOptional') : t('password')}
            error={errors.password}
            hint={auth('passwordHint')}
            className="sm:col-span-2"
          >
            <Input type="password" autoComplete="new-password" {...register('password')} />
          </FormField>
          <DialogFooter className="sm:col-span-2">
            <Button type="button" variant="outline" onClick={onClose}>
              {common('cancel')}
            </Button>
            <Button type="submit" loading={mutation.isPending}>
              {common('save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
