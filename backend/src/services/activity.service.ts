import type { EntityType, Prisma } from '@prisma/client';
import { prisma } from '../config/prisma';
import { logger } from '../config/logger';

export interface ActivityInput {
  userId?: string | null;
  action: string;
  entity: EntityType;
  entityId: string;
  caseId?: string | null;
  clientId?: string | null;
  metadata?: Prisma.InputJsonValue;
}

/** Records an audit entry. Failures are logged but never break the main operation. */
export async function logActivity(input: ActivityInput): Promise<void> {
  try {
    await prisma.activityLog.create({
      data: {
        userId: input.userId ?? null,
        action: input.action,
        entity: input.entity,
        entityId: input.entityId,
        caseId: input.caseId ?? null,
        clientId: input.clientId ?? null,
        metadata: input.metadata,
      },
    });
  } catch (error) {
    logger.error('Failed to record activity', { action: input.action, error });
  }
}

export const activityInclude = {
  user: { select: { id: true, firstName: true, lastName: true, role: true } },
} satisfies Prisma.ActivityLogInclude;
