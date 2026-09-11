import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { signSession, verifySession } from "@/lib/auth/session";

describe("session tokens", () => {
  beforeEach(() => {
    vi.stubEnv("AUTH_SECRET", "test-secret");
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.useRealTimers();
  });

  it("round-trips the user id", async () => {
    const token = await signSession("user-1");
    expect((await verifySession(token))?.sub).toBe("user-1");
  });

  it("rejects a tampered payload", async () => {
    const token = await signSession("user-1");
    const [, sig] = token.split(".");
    const forged = btoa(JSON.stringify({ sub: "admin", exp: 9_999_999_999 }))
      .replaceAll("=", "");
    expect(await verifySession(`${forged}.${sig}`)).toBeNull();
  });

  it("rejects a token signed with another secret", async () => {
    const token = await signSession("user-1");
    vi.stubEnv("AUTH_SECRET", "other-secret");
    expect(await verifySession(token)).toBeNull();
  });

  it("expires after 30 days", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-01T12:00:00Z"));
    const token = await signSession("user-1");
    vi.setSystemTime(new Date("2026-09-30T12:00:00Z"));
    expect(await verifySession(token)).not.toBeNull();
    vi.setSystemTime(new Date("2026-10-02T12:00:00Z"));
    expect(await verifySession(token)).toBeNull();
  });

  it("fails closed without AUTH_SECRET", async () => {
    const token = await signSession("user-1");
    vi.stubEnv("AUTH_SECRET", "");
    expect(await verifySession(token)).toBeNull();
    await expect(signSession("user-1")).rejects.toThrow("AUTH_SECRET");
  });

  it.each([undefined, null, "", "garbage", "a.b.c", "only-body."])(
    "rejects malformed token %s",
    async (token) => {
      expect(await verifySession(token)).toBeNull();
    },
  );
});
