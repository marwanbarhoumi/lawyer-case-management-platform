import { fullName } from '@/lib/utils';
import { casesService, clientsService, usersService } from '@/services/resources';
import type { Role } from '@/types/api';
import type { SelectOption } from '@/components/shared/search-select';

/** Option loaders for <SearchSelect>, all backed by server-side search. */
export const loadClientOptions = async (search: string): Promise<SelectOption[]> => {
  const { data } = await clientsService.list({
    search: search || undefined,
    pageSize: 20,
    sortBy: 'lastName',
    sortOrder: 'asc',
  });
  return data.map((client) => ({
    value: client.id,
    label: fullName(client),
    description: client.phone ?? client.email ?? undefined,
  }));
};

export const caseOptionsLoader =
  (clientId?: string | null, openOnly = false) =>
  async (search: string): Promise<SelectOption[]> => {
    const { data } = await casesService.list({
      search: search || undefined,
      pageSize: 20,
      clientId: clientId ?? undefined,
      status: openOnly ? ['OPEN', 'IN_PROGRESS', 'PENDING'] : undefined,
      sortBy: 'updatedAt',
      sortOrder: 'desc',
    });
    return data.map((item) => ({
      value: item.id,
      label: `${item.referenceNumber} — ${item.title}`,
      description: fullName(item.client),
    }));
  };

export const userOptionsLoader =
  (roles: Role[]) =>
  async (search: string): Promise<SelectOption[]> => {
    const users = await usersService.lookup(roles);
    const term = search.toLowerCase();
    return users
      .filter(
        (user) =>
          !term || `${user.firstName} ${user.lastName} ${user.email}`.toLowerCase().includes(term),
      )
      .map((user) => ({ value: user.id, label: fullName(user), description: user.email }));
  };
