import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const VERSION = "v1";
const BINARY_MAGIC = Buffer.from("AJH1"); // marks encrypted file payloads
const IV_BYTES = 12;
const TAG_BYTES = 16;

/**
 * AES-256-GCM encryption for sensitive data at rest: resume text, parsed resume JSON, and resume files.
 * Text format: v1:<iv>:<authTag>:<ciphertext> (base64). Binary format: AJH1 | iv | tag | ciphertext.
 * The version marker allows key rotation later.
 */
export class FieldCipher {
  private readonly key: Buffer;

  constructor(base64Key: string) {
    this.key = Buffer.from(base64Key, "base64");
    if (this.key.length !== 32) throw new Error("DATA_ENCRYPTION_KEY must be 32 bytes, base64-encoded");
  }

  encrypt(plaintext: string): string {
    const { iv, tag, ct } = this.seal(Buffer.from(plaintext, "utf8"));
    return [VERSION, iv.toString("base64"), tag.toString("base64"), ct.toString("base64")].join(":");
  }

  decrypt(payload: string): string {
    const [version, iv, tag, ct] = payload.split(":");
    if (version !== VERSION || !iv || !tag || !ct) throw new Error("Unrecognized ciphertext format");
    return this.open(Buffer.from(iv, "base64"), Buffer.from(tag, "base64"), Buffer.from(ct, "base64")).toString("utf8");
  }

  encryptBytes(plaintext: Uint8Array): Uint8Array {
    const { iv, tag, ct } = this.seal(Buffer.from(plaintext));
    return Buffer.concat([BINARY_MAGIC, iv, tag, ct]);
  }

  decryptBytes(payload: Uint8Array): Uint8Array {
    const buf = Buffer.from(payload);
    if (!buf.subarray(0, BINARY_MAGIC.length).equals(BINARY_MAGIC)) throw new Error("Unrecognized encrypted file format");
    let offset = BINARY_MAGIC.length;
    const iv = buf.subarray(offset, (offset += IV_BYTES));
    const tag = buf.subarray(offset, (offset += TAG_BYTES));
    return this.open(iv, tag, buf.subarray(offset));
  }

  private seal(plaintext: Buffer) {
    const iv = randomBytes(IV_BYTES);
    const cipher = createCipheriv("aes-256-gcm", this.key, iv);
    const ct = Buffer.concat([cipher.update(plaintext), cipher.final()]);
    return { iv, tag: cipher.getAuthTag(), ct };
  }

  private open(iv: Buffer, tag: Buffer, ct: Buffer): Buffer {
    const decipher = createDecipheriv("aes-256-gcm", this.key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(ct), decipher.final()]);
  }
}
