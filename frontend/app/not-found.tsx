import Link from 'next/link';
import { Scale } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import { Button } from '@/components/ui/button';

export default async function NotFound() {
  const t = await getTranslations('notFound');
  return (
    <main className="bg-background flex min-h-screen flex-col items-center justify-center px-6 text-center">
      <span className="bg-navy text-gold flex size-14 items-center justify-center rounded-full">
        <Scale className="size-7" aria-hidden />
      </span>
      <p className="font-display text-navy mt-6 text-6xl font-semibold">404</p>
      <h1 className="mt-2 text-xl font-semibold">{t('title')}</h1>
      <p className="text-muted-foreground mt-2 max-w-md text-sm">{t('text')}</p>
      <Button asChild className="mt-6">
        <Link href="/dashboard">{t('back')}</Link>
      </Button>
    </main>
  );
}
