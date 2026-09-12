import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { updateSession } from "@/lib/auth/middleware";
import { SESSION_COOKIE, SHARE_COOKIE, signSession } from "@/lib/auth/session";

function request(path: string, session?: string) {
  const headers = new Headers();
  if (session) headers.set("cookie", `${SESSION_COOKIE}=${session}`);
  return new NextRequest(`http://localhost:3388${path}`, { headers });
}

beforeEach(() => {
  vi.stubEnv("AUTH_SECRET", "test-secret");
});
afterEach(() => {
  vi.unstubAllEnvs();
});

describe("middleware", () => {
  it.each(["/gallery", "/map", "/photos/abc", "/settings/users", "/camera"])(
    "sends anonymous visitors of %s to the login",
    async (path) => {
      const res = await updateSession(request(path));
      expect(res.status).toBe(307);
      const location = new URL(res.headers.get("location") ?? "");
      expect(location.pathname).toBe("/login");
      expect(location.searchParams.get("next")).toBe(path);
    },
  );

  it("keeps guest pages open and remembers the share key", async () => {
    const res = await updateSession(request("/gallery/share/map?key=abc"));
    expect(res.status).toBe(200);
    expect(res.cookies.get(SHARE_COOKIE)?.value).toBe("abc");
  });

  it("leaves API routes to their own checks", async () => {
    const res = await updateSession(request("/api/photos"));
    expect(res.status).toBe(200);
    expect(res.headers.get("location")).toBeNull();
  });

  it("lets logged-in users through and skips the login page", async () => {
    const token = await signSession("user-1");
    expect((await updateSession(request("/gallery", token))).status).toBe(200);
    const res = await updateSession(request("/login", token));
    expect(new URL(res.headers.get("location") ?? "").pathname).toBe("/gallery");
  });

  it("does not trust a forged session cookie", async () => {
    const res = await updateSession(request("/gallery", "forged.token"));
    expect(res.status).toBe(307);
  });
});
