import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { UserRow } from "@/lib/db/mappers";
import type { Photo } from "@/lib/types";

const cookieJar = new Map<string, string>();

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) =>
      cookieJar.has(name) ? { name, value: cookieJar.get(name) } : undefined,
  }),
}));

vi.mock("@/lib/db/queries", () => ({
  findUserById: vi.fn(),
  getAlbumIdForShareKey: vi.fn(),
  getPhoto: vi.fn(),
  isAlbumMember: vi.fn(),
}));

const queries = await import("@/lib/db/queries");
const {
  HttpError,
  assertCanAccessAlbum,
  bearerMatchesAuthSecret,
  jsonError,
  requireAdmin,
  requireEditor,
  requirePhotoAccess,
  requirePhotoEditor,
  requireTeilnehmer,
  requireViewer,
} = await import("@/lib/auth/request");
const { SESSION_COOKIE, signSession } = await import("@/lib/auth/session");

const findUserById = vi.mocked(queries.findUserById);
const getAlbumIdForShareKey = vi.mocked(queries.getAlbumIdForShareKey);
const getPhoto = vi.mocked(queries.getPhoto);
const isAlbumMember = vi.mocked(queries.isAlbumMember);

const ALBUM_A = "album-a";
const ALBUM_B = "album-b";

function userRow(overrides: Partial<UserRow> = {}): UserRow {
  return {
    id: "user-anna",
    email: "anna@familie.de",
    display_name: "Anna",
    avatar_url: null,
    role: "teilnehmer",
    is_active: true,
    accent_color: "#0f766e",
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

function photoIn(albumId: string): Photo {
  return { id: "photo-1", album_id: albumId } as Photo;
}

async function loginAs(row: UserRow) {
  findUserById.mockImplementation(async (id) => (id === row.id ? row : null));
  cookieJar.set(SESSION_COOKIE, await signSession(row.id));
}

function req(path = "/api/x", headers: Record<string, string> = {}) {
  return new Request(`http://localhost${path}`, { headers });
}

async function expectStatus(promise: Promise<unknown>, status: number) {
  const err = await promise.then(
    () => null,
    (e: unknown) => e,
  );
  expect(err).toBeInstanceOf(HttpError);
  expect((err as InstanceType<typeof HttpError>).status).toBe(status);
}

beforeEach(() => {
  vi.stubEnv("AUTH_SECRET", "test-secret");
  cookieJar.clear();
  vi.resetAllMocks();
  findUserById.mockResolvedValue(null);
  getAlbumIdForShareKey.mockImplementation(async (key) =>
    key === "key-a" ? ALBUM_A : null,
  );
  isAlbumMember.mockResolvedValue(false);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("requireViewer", () => {
  it("resolves a logged-in participant", async () => {
    await loginAs(userRow());
    const viewer = await requireViewer(req());
    expect(viewer.mode).toBe("teilnehmer");
    expect(viewer.user?.id).toBe("user-anna");
  });

  it("prefers the session over a share key", async () => {
    await loginAs(userRow());
    const viewer = await requireViewer(req("/api/x?key=key-a"));
    expect(viewer.mode).toBe("teilnehmer");
  });

  it("resolves a guest from ?key= and binds the album", async () => {
    const viewer = await requireViewer(req("/api/x?key=key-a"));
    expect(viewer).toMatchObject({ mode: "guest", shareKey: "key-a", albumId: ALBUM_A });
  });

  it("resolves a guest from the share cookie", async () => {
    const viewer = await requireViewer(
      req("/api/x", { cookie: "foo=1; photobuddy_share=key-a" }),
    );
    expect(viewer).toMatchObject({ mode: "guest", albumId: ALBUM_A });
  });

  it("rejects unknown or revoked share keys", async () => {
    await expectStatus(requireViewer(req("/api/x?key=nope")), 401);
  });

  it("rejects anonymous requests", async () => {
    await expectStatus(requireViewer(req()), 401);
  });

  it("treats a deactivated account as logged out", async () => {
    await loginAs(userRow({ is_active: false }));
    await expectStatus(requireViewer(req()), 401);
    await expectStatus(requireTeilnehmer(), 401);
  });

  it("rejects a session for a deleted user", async () => {
    cookieJar.set(SESSION_COOKIE, await signSession("ghost"));
    await expectStatus(requireViewer(req()), 401);
  });
});

describe("assertCanAccessAlbum", () => {
  const guestA = {
    mode: "guest" as const,
    user: null,
    shareKey: "key-a",
    albumId: ALBUM_A,
  };

  it("lets guests see only their link's album", async () => {
    await expect(assertCanAccessAlbum(guestA, ALBUM_A)).resolves.toBeUndefined();
    await expectStatus(assertCanAccessAlbum(guestA, ALBUM_B), 403);
  });

  it("never lets guests upload", async () => {
    await expectStatus(assertCanAccessAlbum(guestA, ALBUM_A, { upload: true }), 403);
  });

  it("requires album membership for participants", async () => {
    await loginAs(userRow());
    const viewer = await requireViewer(req());
    isAlbumMember.mockImplementation(async (albumId) => albumId === ALBUM_A);
    await expect(assertCanAccessAlbum(viewer, ALBUM_A)).resolves.toBeUndefined();
    await expectStatus(assertCanAccessAlbum(viewer, ALBUM_B), 403);
  });

  it("lets admins into every album without a membership lookup", async () => {
    await loginAs(userRow({ id: "user-admin", role: "admin" }));
    const viewer = await requireViewer(req());
    await expect(assertCanAccessAlbum(viewer, ALBUM_B)).resolves.toBeUndefined();
    expect(isAlbumMember).not.toHaveBeenCalled();
  });
});

describe("editing and admin rights", () => {
  it("blocks guests from editing", async () => {
    await expectStatus(requireEditor(req("/api/x?key=key-a")), 403);
  });

  it("allows participants to edit", async () => {
    await loginAs(userRow());
    await expect(requireEditor(req())).resolves.toMatchObject({ id: "user-anna" });
  });

  it("reserves admin routes for admins", async () => {
    await expectStatus(requireAdmin(), 401);
    await loginAs(userRow());
    await expectStatus(requireAdmin(), 403);
    await loginAs(userRow({ id: "user-admin", role: "admin" }));
    await expect(requireAdmin()).resolves.toMatchObject({ role: "admin" });
  });
});

describe("photo access", () => {
  it("returns 404 before checking who asks", async () => {
    getPhoto.mockResolvedValue(null);
    await expectStatus(requirePhotoAccess(req(), "photo-1"), 404);
  });

  it("keeps guests out of other albums' photos", async () => {
    getPhoto.mockResolvedValue(photoIn(ALBUM_B));
    await expectStatus(requirePhotoAccess(req("/api/x?key=key-a"), "photo-1"), 403);
  });

  it("lets guests view but not edit their album's photos", async () => {
    getPhoto.mockResolvedValue(photoIn(ALBUM_A));
    const { viewer } = await requirePhotoAccess(req("/api/x?key=key-a"), "photo-1");
    expect(viewer.mode).toBe("guest");
    await expectStatus(requirePhotoEditor(req("/api/x?key=key-a"), "photo-1"), 403);
  });

  it("lets members edit photos in their album", async () => {
    await loginAs(userRow());
    getPhoto.mockResolvedValue(photoIn(ALBUM_A));
    isAlbumMember.mockResolvedValue(true);
    const { user } = await requirePhotoEditor(req(), "photo-1");
    expect(user.id).toBe("user-anna");
  });
});

describe("bearerMatchesAuthSecret", () => {
  it("accepts only the exact AUTH_SECRET", () => {
    expect(bearerMatchesAuthSecret(req("/", { authorization: "Bearer test-secret" }))).toBe(true);
    expect(bearerMatchesAuthSecret(req("/", { authorization: "Bearer wrong" }))).toBe(false);
    expect(bearerMatchesAuthSecret(req("/", { authorization: "test-secret" }))).toBe(false);
    expect(bearerMatchesAuthSecret(req("/"))).toBe(false);
  });

  it("never matches when AUTH_SECRET is unset", () => {
    vi.stubEnv("AUTH_SECRET", "");
    expect(bearerMatchesAuthSecret(req("/", { authorization: "Bearer " }))).toBe(false);
  });
});

describe("jsonError", () => {
  it("keeps HttpError status and message", async () => {
    const res = jsonError(new HttpError(403, "Nein."));
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: "Nein." });
  });

  it("maps anything else to 500", () => {
    expect(jsonError(new Error("boom")).status).toBe(500);
  });
});
