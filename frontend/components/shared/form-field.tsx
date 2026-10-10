'use client';

import { cloneElement, isValidElement, useId } from 'react';
import { useTranslations } from 'next-intl';
import type { FieldError } from 'react-hook-form';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

type ValidationKey = Parameters<ReturnType<typeof useTranslations<'validation'>>>[0];

interface FormFieldProps {
  label: string;
  error?: FieldError | { message?: string };
  hint?: string;
  optional?: boolean;
  className?: string;
  children: React.ReactElement<{
    id?: string;
    'aria-invalid'?: boolean;
    'aria-describedby'?: string;
  }>;
}

/**
 * Wraps an input with an accessible label, hint and translated validation message.
 * Zod schemas use translation keys (e.g. "required") as error messages.
 */
export function FormField({ label, error, hint, optional, className, children }: FormFieldProps) {
  const t = useTranslations('validation');
  const common = useTranslations('common');
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const message = error?.message;
  const translated = message
    ? t.has(message as ValidationKey)
      ? t(message as ValidationKey)
      : message
    : null;
  const describedBy =
    [hint ? hintId : null, translated ? errorId : null].filter(Boolean).join(' ') || undefined;

  return (
    <div className={cn('grid gap-1.5', className)}>
      <Label htmlFor={id}>
        {label}
        {optional && (
          <span className="text-muted-foreground text-xs font-normal">({common('optional')})</span>
        )}
      </Label>
      {isValidElement(children)
        ? cloneElement(children, {
            id,
            'aria-invalid': Boolean(translated),
            'aria-describedby': describedBy,
          })
        : children}
      {hint && !translated && (
        <p id={hintId} className="text-muted-foreground text-xs">
          {hint}
        </p>
      )}
      {translated && (
        <p id={errorId} role="alert" className="text-destructive text-xs font-medium">
          {translated}
        </p>
      )}
    </div>
  );
}
