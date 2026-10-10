import {
  Bell,
  BarChart3,
  CalendarClock,
  FileSignature,
  FolderKanban,
  FolderOpen,
  LayoutDashboard,
  Receipt,
  Settings,
  SlidersHorizontal,
  UserCog,
  Users,
  type LucideIcon,
} from 'lucide-react';
import type { Role } from '@/types/api';

export type NavKey =
  | 'dashboard'
  | 'clients'
  | 'cases'
  | 'hearings'
  | 'documents'
  | 'contracts'
  | 'invoices'
  | 'reports'
  | 'notifications'
  | 'settings'
  | 'users'
  | 'systemSettings';

export interface NavItem {
  key: NavKey;
  href: string;
  icon: LucideIcon;
  roles?: Role[];
}

export interface NavGroup {
  key: 'workspace' | 'finance' | 'insights' | 'administration';
  items: NavItem[];
}

const MANAGERS: Role[] = ['ADMIN', 'LAWYER'];

export const NAV_GROUPS: NavGroup[] = [
  {
    key: 'workspace',
    items: [
      { key: 'dashboard', href: '/dashboard', icon: LayoutDashboard },
      { key: 'clients', href: '/dashboard/clients', icon: Users },
      { key: 'cases', href: '/dashboard/cases', icon: FolderKanban },
      { key: 'hearings', href: '/dashboard/hearings', icon: CalendarClock },
      { key: 'documents', href: '/dashboard/documents', icon: FolderOpen },
    ],
  },
  {
    key: 'finance',
    items: [
      { key: 'contracts', href: '/dashboard/contracts', icon: FileSignature, roles: MANAGERS },
      { key: 'invoices', href: '/dashboard/invoices', icon: Receipt, roles: MANAGERS },
    ],
  },
  {
    key: 'insights',
    items: [
      { key: 'reports', href: '/dashboard/reports', icon: BarChart3, roles: MANAGERS },
      { key: 'notifications', href: '/dashboard/notifications', icon: Bell },
      { key: 'settings', href: '/dashboard/settings', icon: Settings },
    ],
  },
  {
    key: 'administration',
    items: [
      { key: 'users', href: '/dashboard/admin/users', icon: UserCog, roles: ['ADMIN'] },
      {
        key: 'systemSettings',
        href: '/dashboard/admin/settings',
        icon: SlidersHorizontal,
        roles: ['ADMIN'],
      },
    ],
  },
];

export function visibleGroups(role: Role): NavGroup[] {
  return NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) => !item.roles || item.roles.includes(role)),
  })).filter((group) => group.items.length > 0);
}

/** Post-login destination from a `?next=` value; only in-app dashboard paths are honoured. */
export function safeNextPath(value: string | null): string {
  return value && value.startsWith('/dashboard') ? value : '/dashboard';
}

export function isActivePath(pathname: string, href: string): boolean {
  if (href === '/dashboard') return pathname === '/dashboard';
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** Maps a URL segment to a navigation label key for breadcrumbs. */
export const SEGMENT_LABELS: Record<
  string,
  NavKey | 'new' | 'edit' | 'administration' | 'profile' | 'security'
> = {
  dashboard: 'dashboard',
  clients: 'clients',
  cases: 'cases',
  hearings: 'hearings',
  documents: 'documents',
  contracts: 'contracts',
  invoices: 'invoices',
  reports: 'reports',
  notifications: 'notifications',
  settings: 'settings',
  users: 'users',
  admin: 'administration',
  new: 'new',
  edit: 'edit',
  profile: 'profile',
  security: 'security',
};
