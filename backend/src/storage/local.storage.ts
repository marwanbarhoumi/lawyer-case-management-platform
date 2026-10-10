import { createReadStream } from 'node:fs';
import { mkdir, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { StorageProvider, StoredObject } from './storage.types';

export class LocalStorageProvider implements StorageProvider {
  readonly name = 'local';
  private readonly root: string;

  constructor(directory: string) {
    this.root = path.resolve(directory);
  }

  /** Resolves a key inside the storage root and rejects path traversal attempts. */
  private resolve(key: string): string {
    const target = path.resolve(this.root, key);
    if (!target.startsWith(this.root + path.sep)) {
      throw new Error('Invalid storage key');
    }
    return target;
  }

  async save(key: string, buffer: Buffer): Promise<void> {
    const target = this.resolve(key);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, buffer);
  }

  async read(key: string): Promise<StoredObject> {
    const target = this.resolve(key);
    const info = await stat(target);
    return { stream: createReadStream(target), size: info.size };
  }

  async remove(key: string): Promise<void> {
    await rm(this.resolve(key), { force: true });
  }
}
