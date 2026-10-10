import { env } from '../config/env';
import { LocalStorageProvider } from './local.storage';
import { S3StorageProvider } from './s3.storage';
import type { StorageProvider } from './storage.types';

function createStorage(): StorageProvider {
  if (env.UPLOAD_PROVIDER === 's3') {
    if (!env.S3_BUCKET || !env.UPLOAD_API_KEY || !env.UPLOAD_API_SECRET) {
      throw new Error(
        'UPLOAD_PROVIDER=s3 requires S3_BUCKET, UPLOAD_API_KEY and UPLOAD_API_SECRET',
      );
    }
    return new S3StorageProvider({
      bucket: env.S3_BUCKET,
      region: env.S3_REGION,
      endpoint: env.S3_ENDPOINT,
      accessKeyId: env.UPLOAD_API_KEY,
      secretAccessKey: env.UPLOAD_API_SECRET,
    });
  }
  return new LocalStorageProvider(env.UPLOAD_DIR);
}

export const storage: StorageProvider = createStorage();
export type { StorageProvider } from './storage.types';
