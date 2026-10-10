import type { ContractStatus, Prisma } from '@prisma/client';
import { prisma } from '../config/prisma';
import type { AuthUser } from '../types/auth';
import { ApiError } from '../utils/api-error';
import { startOfDay } from '../utils/dates';
import { buildMeta, toSkipTake } from '../utils/pagination';
import { contains, searchTokens } from '../utils/search';
import type {
  ContractListQuery,
  CreateContractInput,
  UpdateContractInput,
} from '../validators/contract.validators';
import { assertCaseAccess, assertClientAccess, contractScope } from './access.service';
import { logActivity } from './activity.service';
import { getSettings } from './settings.service';

const contractInclude = {
  client: { select: { id: true, firstName: true, lastName: true } },
  case: { select: { id: true, referenceNumber: true, title: true } },
  document: { select: { id: true, name: true, mimeType: true, size: true } },
} satisfies Prisma.ContractInclude;

export async function contractViewFilter(
  view: NonNullable<ContractListQuery['view']>,
  now = new Date(),
): Promise<Prisma.ContractWhereInput> {
  const today = startOfDay(now);
  switch (view) {
    case 'active':
      return { status: 'ACTIVE', OR: [{ endDate: null }, { endDate: { gte: today } }] };
    case 'expired':
      return { OR: [{ status: 'EXPIRED' }, { status: 'ACTIVE', endDate: { lt: today } }] };
    case 'expiring': {
      const { contractExpiryWarningDays } = await getSettings();
      return {
        status: 'ACTIVE',
        endDate: { gte: today, lt: startOfDay(now, contractExpiryWarningDays + 1) },
      };
    }
  }
}

export async function listContracts(user: AuthUser, query: ContractListQuery) {
  const filters: Prisma.ContractWhereInput[] = [contractScope(user)];
  if (query.view) filters.push(await contractViewFilter(query.view));
  if (query.status) filters.push({ status: { in: query.status } });
  if (query.clientId) filters.push({ clientId: query.clientId });
  if (query.caseId) filters.push({ caseId: query.caseId });
  for (const token of searchTokens(query.search)) {
    filters.push({
      OR: [
        { title: contains(token) },
        { case: { referenceNumber: contains(token) } },
        { client: { OR: [{ firstName: contains(token) }, { lastName: contains(token) }] } },
      ],
    });
  }
  const where: Prisma.ContractWhereInput = { AND: filters };
  const [items, total] = await Promise.all([
    prisma.contract.findMany({
      where,
      include: contractInclude,
      orderBy: { [query.sortBy]: { sort: query.sortOrder, nulls: 'last' } },
      ...toSkipTake(query.page, query.pageSize),
    }),
    prisma.contract.count({ where }),
  ]);
  return { items, meta: buildMeta(query.page, query.pageSize, total) };
}

async function findAccessibleContract(user: AuthUser, id: string) {
  const contract = await prisma.contract.findUnique({ where: { id }, include: contractInclude });
  if (!contract) throw ApiError.notFound('Contract not found', 'CONTRACT_NOT_FOUND');
  await assertClientAccess(user, contract.clientId);
  return contract;
}

export function getContract(user: AuthUser, id: string) {
  return findAccessibleContract(user, id);
}

async function validateLinks(
  user: AuthUser,
  clientId: string,
  caseId: string | null | undefined,
  documentId: string | null | undefined,
) {
  if (caseId) {
    const caseRecord = await assertCaseAccess(user, caseId);
    if (caseRecord.clientId !== clientId) {
      throw ApiError.badRequest('The case does not belong to this client', 'CASE_CLIENT_MISMATCH');
    }
  }
  if (documentId) {
    const document = await prisma.document.findUnique({
      where: { id: documentId },
      select: { clientId: true },
    });
    if (!document || document.clientId !== clientId) {
      throw ApiError.badRequest('Invalid contract document', 'INVALID_DOCUMENT');
    }
  }
}

/** An "active" contract whose end date has already passed is stored as EXPIRED. */
function effectiveStatus(status: ContractStatus, endDate: Date | null | undefined): ContractStatus {
  if (status === 'ACTIVE' && endDate && endDate < startOfDay(new Date())) return 'EXPIRED';
  return status;
}

export async function createContract(user: AuthUser, input: CreateContractInput) {
  await assertClientAccess(user, input.clientId);
  await validateLinks(user, input.clientId, input.caseId, input.documentId);
  const contract = await prisma.contract.create({
    data: { ...input, status: effectiveStatus(input.status, input.endDate) },
    include: contractInclude,
  });
  await logActivity({
    userId: user.id,
    action: 'contract.created',
    entity: 'CONTRACT',
    entityId: contract.id,
    caseId: contract.caseId,
    clientId: contract.clientId,
    metadata: { title: contract.title },
  });
  return contract;
}

export async function updateContract(user: AuthUser, id: string, input: UpdateContractInput) {
  const existing = await findAccessibleContract(user, id);
  const clientId = input.clientId ?? existing.clientId;
  if (clientId !== existing.clientId) await assertClientAccess(user, clientId);
  await validateLinks(
    user,
    clientId,
    input.caseId === undefined ? existing.caseId : input.caseId,
    input.documentId === undefined ? existing.document?.id : input.documentId,
  );
  const endDate = input.endDate === undefined ? existing.endDate : input.endDate;
  const contract = await prisma.contract.update({
    where: { id },
    data: { ...input, status: effectiveStatus(input.status ?? existing.status, endDate) },
    include: contractInclude,
  });
  await logActivity({
    userId: user.id,
    action: 'contract.updated',
    entity: 'CONTRACT',
    entityId: id,
    caseId: contract.caseId,
    clientId: contract.clientId,
    metadata: { title: contract.title, status: contract.status },
  });
  return contract;
}

export async function deleteContract(user: AuthUser, id: string) {
  const existing = await findAccessibleContract(user, id);
  await prisma.contract.delete({ where: { id } });
  await logActivity({
    userId: user.id,
    action: 'contract.deleted',
    entity: 'CONTRACT',
    entityId: id,
    caseId: existing.caseId,
    clientId: existing.clientId,
    metadata: { title: existing.title },
  });
}
