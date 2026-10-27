import type { FileStorage, StoredObject } from "@ajh/core";
import type { FieldCipher } from "../crypto/field-cipher";

/** Decorator: encrypts file contents before they reach the underlying storage. */
export class EncryptedFileStorage implements FileStorage {
  constructor(
    private readonly inner: FileStorage,
    private readonly cipher: FieldCipher,
  ) {}

  put(key: string, bytes: Uint8Array, _contentType?: string): Promise<void> {
    // The stored object is ciphertext, so its real content type is opaque.
    return this.inner.put(key, this.cipher.encryptBytes(bytes), "application/octet-stream");
  }

  async get(key: string): Promise<Uint8Array> {
    return this.cipher.decryptBytes(await this.inner.get(key));
  }

  delete(key: string): Promise<void> {
    return this.inner.delete(key);
  }

  /** Sizes are what is actually stored (ciphertext), which is what counts against the quota. */
  list(): AsyncIterable<StoredObject> {
    return this.inner.list();
  }
}
