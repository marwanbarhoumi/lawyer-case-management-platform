'use client';

import { useState } from 'react';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Pencil, Plus, UserCheck, UserX } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { UserDialog } from '@/components/admin/user-dialog';
import { RoleGate } from '@/components/auth/role-gate';
import { useCurrentUser } from '@/components/providers/auth-provider';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { DataTable, Pagination, type Column } from '@/components/shared/data-table';
import { PageHeader } from '@/components/shared/page-header';
import { SearchInput } from '@/components/shared/search-input';
import { RoleBadge } from '@/components/shared/status-badges';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { NativeSelect } from '@/components/ui/input';
import { useErrorToast } from '@/hooks/use-error-message';
import { useFormat } from '@/hooks/use-format';
import { useListState } from '@/hooks/use-list-state';
import { fullName, initials } from '@/lib/utils';
import { usersService } from '@/services/resources';
import { ROLES, type AdminUser, type Role } from '@/types/api';

const FILTERS = ['role', 'isActive'] as const;

function UsersView() {
  const t = useTranslations('admin');
  const common = useTranslations('common');
  const enums = useTranslations('enums.role');
  const me = useCurrentUser();
  const format = useFormat();
  const showError = useErrorToast();
  const queryClient = useQueryClient();
  const list = useListState({ sortBy: 'createdAt', filters: FILTERS });
  const [dialog, setDialog] = useState<{ open: boolean; user: AdminUser | null }>({
    open: false,
    user: null,
  });
  const role = list.filters.role as Role | undefined;

  const query = useQuery({
    queryKey: ['users', 'list', list.params, list.filters],
    queryFn: () =>
      usersService.list({
        ...list.params,
        role: role ? [role] : undefined,
        isActive: list.filters.isActive,
      }),
    placeholderData: keepPreviousData,
  });

  const toggleActive = useMutation({
    mutationFn: (user: AdminUser) => usersService.update(user.id, { isActive: !user.isActive }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast.success(t('userUpdated'));
    },
    onError: showError,
  });

  const columns: Column<AdminUser>[] = [
    {
      key: 'name',
      header: common('name'),
      sortKey: 'lastName',
      cell: (user) => (
        <div className="flex items-center gap-3">
          <Avatar>
            <AvatarFallback>{initials(user)}</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="truncate font-medium">{fullName(user)}</p>
            <p className="text-muted-foreground truncate text-xs" dir="ltr">
              {user.email}
            </p>
          </div>
        </div>
      ),
    },
    {
      key: 'role',
      header: t('role'),
      sortKey: 'role',
      cell: (user) => <RoleBadge role={user.role} />,
    },
    {
      key: 'status',
      header: common('status'),
      hideBelow: 'sm',
      cell: (user) => (
        <Badge variant={user.isActive ? 'success' : 'muted'}>
          {user.isActive ? t('active') : t('inactive')}
        </Badge>
      ),
    },
    {
      key: 'workload',
      header: common('details'),
      hideBelow: 'lg',
      cell: (user) => (
        <span className="text-muted-foreground text-sm">
          {t('workload', {
            cases: user._count.cases + user._count.caseAssignments,
            clients: user._count.clients,
          })}
        </span>
      ),
    },
    {
      key: 'createdAt',
      header: common('createdAt'),
      sortKey: 'createdAt',
      hideBelow: 'md',
      cell: (user) => format.date(user.createdAt),
    },
    {
      key: 'actions',
      header: common('actions'),
      className: 'text-end',
      cell: (user) => (
        <div className="flex justify-end gap-1">
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`${common('edit')} — ${fullName(user)}`}
            onClick={() => setDialog({ open: true, user })}
          >
            <Pencil />
          </Button>
          {user.id !== me.id &&
            (user.isActive ? (
              <ConfirmDialog
                title={`${t('deactivate')} — ${fullName(user)}`}
                confirmLabel={t('deactivate')}
                onConfirm={() => toggleActive.mutateAsync(user)}
                trigger={
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="text-destructive"
                    aria-label={`${t('deactivate')} — ${fullName(user)}`}
                  >
                    <UserX />
                  </Button>
                }
              />
            ) : (
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={`${t('activate')} — ${fullName(user)}`}
                onClick={() => toggleActive.mutate(user)}
              >
                <UserCheck />
              </Button>
            ))}
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title={t('usersTitle')}
        description={t('usersSubtitle')}
        actions={
          <Button onClick={() => setDialog({ open: true, user: null })}>
            <Plus /> {t('newUser')}
          </Button>
        }
      />
      <Card className="gap-0 py-0">
        <div className="flex flex-col gap-3 border-b p-4 sm:flex-row sm:flex-wrap sm:items-center">
          <SearchInput
            value={list.search}
            onChange={list.setSearch}
            placeholder={t('searchPlaceholder')}
          />
          <NativeSelect
            aria-label={t('role')}
            className="sm:w-44"
            value={role ?? ''}
            onChange={(event) => list.setFilter('role', event.target.value || undefined)}
          >
            <option value="">
              {t('role')} — {common('all')}
            </option>
            {ROLES.map((value) => (
              <option key={value} value={value}>
                {enums(value)}
              </option>
            ))}
          </NativeSelect>
          <NativeSelect
            aria-label={common('status')}
            className="sm:w-40"
            value={list.filters.isActive ?? ''}
            onChange={(event) => list.setFilter('isActive', event.target.value || undefined)}
          >
            <option value="">
              {common('status')} — {common('all')}
            </option>
            <option value="true">{t('active')}</option>
            <option value="false">{t('inactive')}</option>
          </NativeSelect>
        </div>
        <DataTable
          columns={columns}
          data={query.data?.data}
          rowKey={(user) => user.id}
          isLoading={query.isLoading}
          error={query.error}
          onRetry={() => query.refetch()}
          sortBy={list.sortBy}
          sortOrder={list.sortOrder}
          onSort={list.setSort}
        />
        <Pagination
          meta={query.data?.meta}
          onPageChange={list.setPage}
          onPageSizeChange={list.setPageSize}
        />
      </Card>
      <UserDialog
        open={dialog.open}
        user={dialog.user}
        onClose={() => setDialog({ open: false, user: null })}
      />
    </div>
  );
}

export default function AdminUsersPage() {
  return (
    <RoleGate roles={['ADMIN']}>
      <UsersView />
    </RoleGate>
  );
}
