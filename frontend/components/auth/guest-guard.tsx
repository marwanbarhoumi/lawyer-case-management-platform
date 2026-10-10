'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/providers/auth-provider';
import { safeNextPath } from '@/lib/navigation';

/** Sends already authenticated users to the dashboard (or to the page they were heading to). */
export function GuestGuard({ children }: { children: React.ReactNode }) {
  const { status } = useAuth();
  const router = useRouter();
  useEffect(() => {
    if (status !== 'authenticated') return;
    router.replace(safeNextPath(new URLSearchParams(window.location.search).get('next')));
  }, [status, router]);
  return <>{children}</>;
}
