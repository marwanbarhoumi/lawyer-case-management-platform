import type { Readable } from 'node:stream';

export interface StoredObject {
  stream: Readable;
  size?: number;
}

/** Abstraction over the file storage backend (local disk, S3-compatible, ...). */
export interface StorageProvider {
  readonly name: string;
  /** Persists the buffer under `key`. */
  save(key: string, buffer: Buffer, mimeType: string): Promise<void>;
  /** Opens a read stream for `key`. Throws when the object does not exist. */
  read(key: string): Promise<StoredObject>;
  /** Removes `key`. Must not throw when the object is already gone. */
  remove(key: string): Promise<void>;
}
