import { randomBytes } from "node:crypto";
import type { FileStorage } from "@ajh/core";
import { describe, expect, it } from "vitest";
import { EncryptedFileStorage, FieldCipher } from "../src";

const cipher = new FieldCipher(randomBytes(32).toString("base64"));

describe("FieldCipher", () => {
  it("round-trips text and never stores plaintext", () => {
    const secret = "Jane Rivera — 555-0100";
    const enc = cipher.encrypt(secret);
    expect(enc).not.toContain("Jane");
    expect(cipher.decrypt(enc)).toBe(secret);
  });

  it("uses a fresh IV each time", () => {
    expect(cipher.encrypt("same")).not.toBe(cipher.encrypt("same"));
  });

  it("detects tampering", () => {
    const [v, iv, tag, ct] = cipher.encrypt("hello").split(":");
    const flipped = Buffer.from(ct!, "base64");
    flipped[0]! ^= 1;
    expect(() => cipher.decrypt([v, iv, tag, flipped.toString("base64")].join(":"))).toThrow();
  });

  it("rejects a key from a different user setup", () => {
    const other = new FieldCipher(randomBytes(32).toString("base64"));
    expect(() => other.decrypt(cipher.encrypt("x"))).toThrow();
  });

  it("rejects keys of the wrong size", () => {
    expect(() => new FieldCipher(randomBytes(16).toString("base64"))).toThrow(/32 bytes/);
  });
});

describe("EncryptedFileStorage", () => {
  it("stores ciphertext and returns the original bytes", async () => {
    const raw = new Map<string, Uint8Array>();
    const inner: FileStorage = {
      put: async (k, b) => void raw.set(k, b),
      get: async (k) => raw.get(k)!,
      delete: async (k) => void raw.delete(k),
      list: async function* () {},
    };
    const storage = new EncryptedFileStorage(inner, cipher);
    const original = new TextEncoder().encode("%PDF resume bytes");

    await storage.put("k", original, "application/pdf");
    expect(Buffer.from(raw.get("k")!).includes(Buffer.from("resume"))).toBe(false);
    expect(new TextDecoder().decode(await storage.get("k"))).toBe("%PDF resume bytes");
  });
});
