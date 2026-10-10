'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { LogOut, ShieldCheck, UserRound } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useAuth, useCurrentUser } from '@/components/providers/auth-provider';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { fullName, initials } from '@/lib/utils';

export function UserMenu() {
  const t = useTranslations('nav');
  const enums = useTranslations('enums');
  const user = useCurrentUser();
  const { logout } = useAuth();
  const router = useRouter();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="focus-visible:ring-ring flex items-center gap-2 rounded-full p-0.5 focus-visible:ring-2 focus-visible:outline-none"
        aria-label={fullName(user)}
      >
        <Avatar>
          <AvatarFallback>{initials(user)}</AvatarFallback>
        </Avatar>
        <span className="hidden text-start leading-tight md:block">
          <span className="block text-sm font-medium">{fullName(user)}</span>
          <span className="text-muted-foreground block text-xs">{enums(`role.${user.role}`)}</span>
        </span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>
          <span className="block truncate">{fullName(user)}</span>
          <span className="text-muted-foreground block truncate text-xs font-normal">
            {user.email}
          </span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/dashboard/settings/profile">
            <UserRound /> {t('profile')}
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/dashboard/settings/security">
            <ShieldCheck /> {t('security')}
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          destructive
          onSelect={async () => {
            await logout();
            router.replace('/login');
          }}
        >
          <LogOut /> {t('logout')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
