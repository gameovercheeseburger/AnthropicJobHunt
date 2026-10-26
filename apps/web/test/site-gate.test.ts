import { describe, expect, it } from "vitest";
import { gateConfig, gateToken, isTokenValid, safeEqual, safeNextPath } from "../lib/site-gate";

// Test-only values.
const config = { username: "TestAdmin", password: "correct horse", secret: "s3cret" };

describe("admin sign-in gate", () => {
  it("is off unless both username and password are configured", () => {
    expect(gateConfig({})).toBeNull();
    expect(gateConfig({ ADMIN_USERNAME: "a" })).toBeNull();
    expect(gateConfig({ ADMIN_PASSWORD: "b" })).toBeNull();
  });

  it("requires AUTH_SECRET when credentials are set", () => {
    expect(() => gateConfig({ ADMIN_USERNAME: "a", ADMIN_PASSWORD: "b" })).toThrow(/AUTH_SECRET/);
  });

  it("accepts the right credentials, with a case-insensitive username", async () => {
    const expected = await gateToken(config);
    expect(await gateToken(config, { username: " testadmin ", password: "correct horse" })).toBe(expected);
    expect(await isTokenValid(config, expected)).toBe(true);
  });

  it("rejects a wrong username or password", async () => {
    expect(await isTokenValid(config, await gateToken(config, { username: "TestAdmin", password: "wrong" }))).toBe(false);
    expect(await isTokenValid(config, await gateToken(config, { username: "Other", password: "correct horse" }))).toBe(
      false,
    );
    expect(await isTokenValid(config, undefined)).toBe(false);
  });

  it("is not fooled by moving characters between username and password", async () => {
    const shifted = await gateToken(config, { username: "TestAdmincorrect", password: " horse" });
    expect(await isTokenValid(config, shifted)).toBe(false);
  });

  it("signs everyone out when the password changes", async () => {
    const token = await gateToken(config);
    expect(await isTokenValid({ ...config, password: "rotated" }, token)).toBe(false);
  });

  it("does not expose the credentials in the cookie", async () => {
    const token = await gateToken(config);
    expect(token).not.toMatch(/horse|testadmin/i);
  });

  it("compares safely", () => {
    expect(safeEqual("abc", "abc")).toBe(true);
    expect(safeEqual("abc", "abd")).toBe(false);
    expect(safeEqual("abc", "ab")).toBe(false);
  });

  it.each([
    ["/profile", "/profile"],
    ["/?a=1", "/?a=1"],
    ["//evil.com", "/"],
    ["/\\evil.com", "/"],
    ["https://evil.com", "/"],
    [undefined, "/"],
  ])("only redirects to local paths (%s)", (input, expected) => {
    expect(safeNextPath(input)).toBe(expected);
  });
});
