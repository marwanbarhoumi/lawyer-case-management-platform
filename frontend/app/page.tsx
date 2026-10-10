import Link from 'next/link';
import {
  BellRing,
  CalendarClock,
  FileLock2,
  FolderKanban,
  Receipt,
  ShieldCheck,
  Users,
} from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import { Brand } from '@/components/layout/brand';
import { LanguageSwitcher } from '@/components/layout/language-switcher';
import { Button } from '@/components/ui/button';

const FEATURES = [
  { key: 'hearings', icon: CalendarClock },
  { key: 'cases', icon: FolderKanban },
  { key: 'clients', icon: Users },
  { key: 'documents', icon: FileLock2 },
  { key: 'invoices', icon: Receipt },
  { key: 'security', icon: ShieldCheck },
] as const;

export default async function LandingPage() {
  const t = await getTranslations('landing');

  return (
    <div className="flex min-h-screen flex-col">
      <header className="bg-navy">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <Brand inverted />
          <nav className="flex items-center gap-2" aria-label="Actions">
            <LanguageSwitcher className="text-white hover:bg-white/10 hover:text-white" />
            <Button asChild variant="gold" size="sm">
              <Link href="/login">{t('ctaLogin')}</Link>
            </Button>
          </nav>
        </div>
      </header>

      <main id="main" className="flex-1">
        <section className="bg-navy relative overflow-hidden pb-24 text-white">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_80%_10%,oklch(0.74_0.12_80/0.18),transparent_45%)]"
          />
          <div className="relative mx-auto grid max-w-6xl gap-12 px-4 pt-14 sm:px-6 lg:grid-cols-[1.2fr_1fr] lg:items-center">
            <div>
              <span className="border-gold/40 bg-gold/10 text-gold inline-flex items-center gap-2 rounded-full border px-3 py-1 text-sm">
                <BellRing className="size-4" aria-hidden />
                {t('badge')}
              </span>
              <h1 className="font-display mt-6 text-4xl leading-tight font-bold sm:text-5xl lg:text-6xl">
                {t('title')}
              </h1>
              <p className="mt-6 max-w-xl text-lg text-white/75">{t('subtitle')}</p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Button asChild variant="gold" size="lg">
                  <Link href="/register">{t('ctaStart')}</Link>
                </Button>
                <Button
                  asChild
                  size="lg"
                  variant="outline"
                  className="border-white/30 bg-transparent text-white hover:bg-white/10 hover:text-white"
                >
                  <Link href="/dashboard">{t('ctaDashboard')}</Link>
                </Button>
              </div>
            </div>
            <figure className="rounded-2xl border border-white/10 bg-white/5 p-8 shadow-2xl backdrop-blur">
              <blockquote className="font-display text-2xl leading-snug text-white/90 italic">
                {t('problem')}
              </blockquote>
              <figcaption className="text-gold mt-6 flex items-center gap-3">
                <span className="bg-gold h-px w-10" aria-hidden />
                {t('problemSolved')}
              </figcaption>
            </figure>
          </div>
        </section>

        <section className="mx-auto -mt-12 max-w-6xl px-4 pb-20 sm:px-6">
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map(({ key, icon: Icon }) => (
              <li key={key} className="bg-card rounded-xl border p-6 shadow-sm">
                <span className="bg-accent text-accent-foreground flex size-10 items-center justify-center rounded-lg">
                  <Icon className="size-5" aria-hidden />
                </span>
                <h2 className="mt-4 font-semibold">{t(`features.${key}.title`)}</h2>
                <p className="text-muted-foreground mt-1.5 text-sm">{t(`features.${key}.text`)}</p>
              </li>
            ))}
          </ul>
        </section>
      </main>

      <footer className="text-muted-foreground border-t py-6 text-center text-sm">
        {t('footer', { year: new Date().getFullYear() })}
      </footer>
    </div>
  );
}
