'use client';

import { useAuth } from '@/components/providers/auth-provider';
import { ErrorState } from '@/components/shared/states';
import { ApiError } from '@/lib/api-client';
import type { Role } from '@/types/api';

const FORBIDDEN = new ApiError(403, 'Forbidden', 'FORBIDDEN');

/** Hides pages a role cannot use. The API enforces the same rules independently. */
export function RoleGate({ roles, children }: { roles: Role[]; children: React.ReactNode }) {
  const { hasRole } = useAuth();
  if (!hasRole(...roles)) return <ErrorState error={FORBIDDEN} />;
  return <>{children}</>;
}
