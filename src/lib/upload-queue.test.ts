import { describe, expect, it } from "vitest";
import {
  MAX_SERVER_ATTEMPTS,
  classifyUploadResponse,
  pickNextUpload,
  retryDelayMs,
  type QueuedUpload,
} from "@/lib/upload-queue";

describe("classifyUploadResponse", () => {
  it("finishes on a saved photo, also for an idempotent replay", () => {
    expect(classifyUploadResponse(200, { photo: { id: "p1" } })).toEqual({
      type: "done",
      photoId: "p1",
    });
  });

  it("keeps retrying on network loss", () => {
    expect(classifyUploadResponse(0, {})).toMatchObject({ type: "retry", network: true });
  });

  it.each([408, 429, 500, 502, 503])("retries server trouble (%i)", (status) => {
    expect(classifyUploadResponse(status, {})).toMatchObject({
      type: "retry",
      network: false,
    });
  });

  it("asks the user about duplicates", () => {
    const duplicate = { photo_id: "p0", author_name: "Ben" };
    expect(
      classifyUploadResponse(409, { error: "Ähnliches Foto schon von Ben", duplicate }),
    ).toEqual({
      type: "duplicate",
      duplicate,
      message: "Ähnliches Foto schon von Ben",
    });
  });

  it("pauses for login on 401", () => {
    expect(classifyUploadResponse(401, {}).type).toBe("auth");
  });

  it.each([400, 403, 409, 413])("gives up on permanent rejection (%i)", (status) => {
    expect(classifyUploadResponse(status, { error: "Nein." })).toEqual({
      type: "rejected",
      message: "Nein.",
    });
  });
});

describe("retryDelayMs", () => {
  it("backs off and caps at five minutes", () => {
    expect(retryDelayMs(1)).toBe(5_000);
    expect(retryDelayMs(2)).toBe(15_000);
    expect(retryDelayMs(3)).toBe(60_000);
    expect(retryDelayMs(99)).toBe(300_000);
    expect(retryDelayMs(0)).toBe(5_000);
  });

  it("gives up on server errors within a few tries", () => {
    expect(MAX_SERVER_ATTEMPTS).toBeGreaterThanOrEqual(3);
  });
});

describe("pickNextUpload", () => {
  const item = (id: string, overrides: Partial<QueuedUpload>) =>
    ({
      id,
      createdAt: 0,
      status: "pending",
      nextAttemptAt: 0,
      ...overrides,
    }) as QueuedUpload;

  it("sends the oldest ready item first", () => {
    const items = [
      item("b", { createdAt: 2 }),
      item("a", { createdAt: 1 }),
      item("c", { createdAt: 3 }),
    ];
    expect(pickNextUpload(items, 10)?.id).toBe("a");
  });

  it("skips items still backing off or waiting for a decision", () => {
    const items = [
      item("waiting", { createdAt: 1, nextAttemptAt: 100 }),
      item("dup", { createdAt: 2, status: "duplicate" }),
      item("failed", { createdAt: 3, status: "failed" }),
      item("ready", { createdAt: 4 }),
    ];
    expect(pickNextUpload(items, 10)?.id).toBe("ready");
    expect(pickNextUpload(items.slice(0, 3), 10)).toBeNull();
    expect(pickNextUpload(items.slice(0, 1), 100)?.id).toBe("waiting");
  });
});
