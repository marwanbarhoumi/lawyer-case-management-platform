'use client';

import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Upload } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { z } from 'zod';
import { FormField } from '@/components/shared/form-field';
import { SearchSelect } from '@/components/shared/search-select';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input, NativeSelect } from '@/components/ui/input';
import { useErrorToast } from '@/hooks/use-error-message';
import { ACCEPTED_EXTENSIONS, MAX_UPLOAD_MB, isAcceptedFile } from '@/lib/files';
import { caseOptionsLoader, loadClientOptions } from '@/lib/option-loaders';
import { optionalString } from '@/lib/validation';
import { documentsService } from '@/services/resources';
import { DOCUMENT_TYPES, type DocumentItem, type DocumentType } from '@/types/api';

const schema = z
  .object({
    file: z
      .instanceof(File, { message: 'fileRequired' })
      .refine(isAcceptedFile, 'invalidFileType')
      .refine((file) => file.size <= MAX_UPLOAD_MB * 1024 * 1024, 'fileTooLarge'),
    name: optionalString(200),
    type: z.enum(DOCUMENT_TYPES),
    linkTo: z.enum(['case', 'client']),
    caseId: z.string().nullable(),
    clientId: z.string().nullable(),
  })
  .refine((value) => (value.linkTo === 'case' ? value.caseId : value.clientId), {
    message: 'required',
    path: ['caseId'],
  });

type FormValues = z.input<typeof schema>;

interface UploadDialogProps {
  /** Fixed link (from a case or client page): the selector is hidden. */
  caseId?: string;
  clientId?: string;
  defaultType?: DocumentType;
  trigger?: React.ReactNode;
  onUploaded?: (document: DocumentItem) => void;
}

export function DocumentUploadDialog({
  caseId,
  clientId,
  defaultType = 'OTHER',
  trigger,
  onUploaded,
}: UploadDialogProps) {
  const t = useTranslations('documents');
  const common = useTranslations('common');
  const enums = useTranslations('enums.documentType');
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();
  const showError = useErrorToast();
  const fixedLink = Boolean(caseId || clientId);

  const {
    register,
    control,
    handleSubmit,
    watch,
    reset,
    setValue,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: '',
      type: defaultType,
      linkTo: clientId && !caseId ? 'client' : 'case',
      caseId: caseId ?? null,
      clientId: clientId ?? null,
    },
  });
  const linkTo = watch('linkTo');

  const mutation = useMutation({
    mutationFn: (form: FormData) => documentsService.upload(form),
    onSuccess: (document) => {
      queryClient.invalidateQueries({ queryKey: ['documents'] });
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      toast.success(t('uploaded'));
      setOpen(false);
      reset();
      onUploaded?.(document);
    },
    onError: showError,
  });

  const onSubmit = handleSubmit((values) => {
    const form = new FormData();
    form.append('file', values.file as File);
    form.append('type', values.type);
    if (values.name?.trim()) form.append('name', values.name.trim());
    if (values.linkTo === 'case' && values.caseId) form.append('caseId', values.caseId);
    if (values.linkTo === 'client' && values.clientId) form.append('clientId', values.clientId);
    if (caseId && clientId) form.append('clientId', clientId);
    mutation.mutate(form);
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (!mutation.isPending) setOpen(value);
      }}
    >
      <DialogTrigger asChild>
        {trigger ?? (
          <Button>
            <Upload /> {t('upload')}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('uploadTitle')}</DialogTitle>
          <DialogDescription>{t('allowedTypes', { size: MAX_UPLOAD_MB })}</DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="grid gap-4" noValidate>
          <FormField label={t('file')} error={errors.file as { message?: string } | undefined}>
            <Input
              type="file"
              accept={ACCEPTED_EXTENSIONS.join(',')}
              className="cursor-pointer file:me-3 file:cursor-pointer"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) setValue('file', file, { shouldValidate: true });
              }}
            />
          </FormField>
          <FormField label={t('name')} hint={t('nameHint')} error={errors.name} optional>
            <Input {...register('name')} />
          </FormField>
          <FormField label={t('category')} error={errors.type}>
            <NativeSelect {...register('type')}>
              {DOCUMENT_TYPES.map((type) => (
                <option key={type} value={type}>
                  {enums(type)}
                </option>
              ))}
            </NativeSelect>
          </FormField>
          {!fixedLink && (
            <>
              <fieldset className="grid gap-2">
                <legend className="mb-1 text-sm font-medium">{t('linkTo')}</legend>
                <div className="flex gap-4 text-sm">
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      value="case"
                      className="accent-[var(--navy)]"
                      {...register('linkTo')}
                    />
                    {t('linkCase')}
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      value="client"
                      className="accent-[var(--navy)]"
                      {...register('linkTo')}
                    />
                    {t('linkClient')}
                  </label>
                </div>
              </fieldset>
              {linkTo === 'case' ? (
                <FormField label={t('case')} error={errors.caseId}>
                  <Controller
                    control={control}
                    name="caseId"
                    render={({ field }) => (
                      <SearchSelect
                        queryKey="cases"
                        value={field.value}
                        onChange={field.onChange}
                        loadOptions={caseOptionsLoader()}
                      />
                    )}
                  />
                </FormField>
              ) : (
                <FormField label={t('client')} error={errors.caseId}>
                  <Controller
                    control={control}
                    name="clientId"
                    render={({ field }) => (
                      <SearchSelect
                        queryKey="clients"
                        value={field.value}
                        onChange={field.onChange}
                        loadOptions={loadClientOptions}
                      />
                    )}
                  />
                </FormField>
              )}
            </>
          )}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={mutation.isPending}
              onClick={() => setOpen(false)}
            >
              {common('cancel')}
            </Button>
            <Button type="submit" loading={mutation.isPending}>
              {mutation.isPending ? t('uploading') : common('upload')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
