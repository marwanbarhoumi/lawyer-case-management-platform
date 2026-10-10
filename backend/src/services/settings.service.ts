import { prisma } from '../config/prisma';
import type { AuthUser } from '../types/auth';
import type { UpdateSettingsInput } from '../validators/settings.validators';
import { logActivity } from './activity.service';

const SETTINGS_ID = 'default';

export async function getSettings() {
  return prisma.systemSettings.upsert({
    where: { id: SETTINGS_ID },
    update: {},
    create: { id: SETTINGS_ID },
  });
}

export async function updateSettings(user: AuthUser, input: UpdateSettingsInput) {
  await getSettings();
  const settings = await prisma.systemSettings.update({ where: { id: SETTINGS_ID }, data: input });
  await logActivity({
    userId: user.id,
    action: 'settings.updated',
    entity: 'SETTINGS',
    entityId: SETTINGS_ID,
    metadata: { fields: Object.keys(input) },
  });
  return settings;
}
