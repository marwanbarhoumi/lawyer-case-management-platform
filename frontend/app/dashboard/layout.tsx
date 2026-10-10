'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Scale } from 'lucide-react';
import { DashboardShell } from '@/components/layout/dashboard-shell';
import { useAuth } from '@/components/providers/auth-provider';

/**
 * Client-side guard for UX only: every API call is authorised by the backend,
 * which remains the source of truth for authentication and roles.
 */
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { status } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.replace(`/login?next=${encodeURIComponent(pathname)}`);
    }
  }, [status, router, pathname]);

  if (status !== 'authenticated') {
    return (
      <div
        className="bg-navy flex min-h-screen items-center justify-center"
        role="status"
        aria-live="polite"
      >
        <Scale className="text-gold size-10 animate-pulse" aria-hidden />
      </div>
    );
  }

  return <DashboardShell>{children}</DashboardShell>;
}
