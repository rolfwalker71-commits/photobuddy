import { notifyPhotosChanged } from "@/lib/photos-sync";
import type { DuplicateHint, MediaKind } from "@/lib/types";

/**
 * Persistent upload queue. Prepared (compressed) files wait in IndexedDB until
 * the network is back, survive reloads and app restarts, and are sent one by
 * one with progress. Each item carries a client id the server uses to answer
 * retries idempotently, so a lost response never creates a second photo.
 */

const DB_NAME = "photobuddy-uploads";
const STORE = "uploads";
const LOCK_NAME = "photobuddy-upload-queue";
const CHANNEL_NAME = "photobuddy-uploads";
const RETRY_STEPS_MS = [5_000, 15_000, 60_000, 180_000, 300_000];
/** Server errors (5xx) give up after this many tries; network errors never do. */
export const MAX_SERVER_ATTEMPTS = 5;
const NOTIFY_EVERY_MS = 4_000;
const POLL_MS = 30_000;

export type QueueStatus = "pending" | "uploading" | "failed" | "duplicate";

export type UploadFields = {
  albumId: string;
  title: string;
  description: string;
  tags: string;
  takenAt: string;
  latitude: string;
  longitude: string;
  locationName: string;
  kind: MediaKind;
  width: string;
  height: string;
  durationMs: string;
};

export type NewUpload = {
  fields: UploadFields;
  file: Blob;
  fileName: string;
  thumb: Blob | null;
};

export type QueuedUpload = NewUpload & {
  id: string;
  createdAt: number;
  status: QueueStatus;
  attempts: number;
  nextAttemptAt: number;
  error: string | null;
  duplicate: DuplicateHint | null;
  keepDuplicate: boolean;
};

export type UploadOutcome =
  | { type: "done"; photoId: string }
  | { type: "duplicate"; duplicate: DuplicateHint; message: string }
  | { type: "auth"; message: string }
  | { type: "rejected"; message: string }
  | { type: "retry"; message: string; network: boolean };

export type WaitResult = UploadOutcome | { type: "queued" };

export type QueueSnapshot = {
  items: QueuedUpload[];
  activeId: string | null;
  /** 0..1 for the item currently being sent. */
  progress: number | null;
  online: boolean;
  /**
   * Last attempt could not reach the server. Phones often report online on a
   * weak signal, so this, not navigator.onLine, is what "waiting for network" means.
   */
  networkError: boolean;
  pausedForAuth: boolean;
  /** Uploaded since the queue was last empty — for "3 von 12". */
  doneCount: number;
  /** Set when the queue drained, for a short "12 hochgeladen" confirmation. */
  finished: { count: number; at: number } | null;
};

type UploadResponseBody = {
  photo?: { id?: string };
  error?: string;
  duplicate?: DuplicateHint;
};

// ---------------------------------------------------------------------------
// Pure helpers (unit-tested)

export function classifyUploadResponse(
  status: number,
  body: UploadResponseBody,
): UploadOutcome {
  if (status === 0) {
    return { type: "retry", message: "Keine Verbindung.", network: true };
  }
  if (status >= 200 && status < 300) {
    if (body.photo?.id) return { type: "done", photoId: body.photo.id };
    return { type: "retry", message: "Unerwartete Antwort.", network: false };
  }
  if (status === 409 && body.duplicate) {
    return {
      type: "duplicate",
      duplicate: body.duplicate,
      message: body.error || "Ähnliches Foto schon vorhanden.",
    };
  }
  if (status === 401) {
    return { type: "auth", message: "Bitte neu anmelden — danach geht der Upload weiter." };
  }
  if (status === 408 || status === 429 || status >= 500) {
    return {
      type: "retry",
      message: body.error || `Server nicht erreichbar (${status}).`,
      network: false,
    };
  }
  return { type: "rejected", message: body.error || `Upload abgelehnt (${status}).` };
}

export function retryDelayMs(attempts: number) {
  const index = Math.min(Math.max(attempts, 1), RETRY_STEPS_MS.length) - 1;
  return RETRY_STEPS_MS[index];
}

/** Next item to send: oldest pending one whose backoff has elapsed. */
export function pickNextUpload(items: QueuedUpload[], now: number) {
  return (
    items
      .filter((item) => item.status === "pending" && item.nextAttemptAt <= now)
      .sort((a, b) => a.createdAt - b.createdAt)[0] ?? null
  );
}

// ---------------------------------------------------------------------------
// IndexedDB

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb() {
  if (!dbPromise) {
    dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => {
        if (!req.result.objectStoreNames.contains(STORE)) {
          req.result.createObjectStore(STORE, { keyPath: "id" });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    dbPromise.catch(() => {
      dbPromise = null;
    });
  }
  return dbPromise;
}

async function withStore<T>(
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const db = await openDb();
  return new Promise<T>((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const req = run(tx.objectStore(STORE));
    tx.oncomplete = () => resolve(req.result);
    tx.onerror = () => reject(tx.error ?? req.error);
    tx.onabort = () => reject(tx.error ?? req.error);
  });
}

const readAll = () =>
  withStore<QueuedUpload[]>("readonly", (store) => store.getAll());
const readOne = (id: string) =>
  withStore<QueuedUpload | undefined>("readonly", (store) => store.get(id));
const writeOne = (item: QueuedUpload) =>
  withStore("readwrite", (store) => store.put(item));
const deleteOne = (id: string) =>
  withStore("readwrite", (store) => store.delete(id));

async function patchItem(id: string, patch: Partial<QueuedUpload>) {
  const current = await readOne(id);
  if (!current) return null;
  const next = { ...current, ...patch };
  await writeOne(next);
  return next;
}

// ---------------------------------------------------------------------------
// Observable state

const EMPTY: QueueSnapshot = {
  items: [],
  activeId: null,
  progress: null,
  online: true,
  networkError: false,
  pausedForAuth: false,
  doneCount: 0,
  finished: null,
};

let snapshot: QueueSnapshot = EMPTY;
const listeners = new Set<() => void>();
const waiters = new Map<string, Array<(result: WaitResult) => void>>();
let channel: BroadcastChannel | null = null;

function emit(patch: Partial<QueueSnapshot>) {
  snapshot = { ...snapshot, ...patch };
  for (const listener of listeners) listener();
}

export function getUploadQueueSnapshot() {
  return snapshot;
}

export function getServerUploadQueueSnapshot() {
  return EMPTY;
}

export function subscribeUploadQueue(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

async function refresh() {
  try {
    const items = (await readAll()).sort((a, b) => a.createdAt - b.createdAt);
    const drained = items.length === 0 && snapshot.doneCount > 0;
    emit({
      items,
      online: navigator.onLine,
      doneCount: items.length === 0 ? 0 : snapshot.doneCount,
      finished: drained
        ? { count: snapshot.doneCount, at: Date.now() }
        : items.length > 0
          ? null
          : snapshot.finished,
    });
  } catch {
    /* IndexedDB unavailable (private mode) — queue stays empty */
  }
}

function broadcast() {
  try {
    channel?.postMessage("changed");
  } catch {
    /* ignore */
  }
}

function settle(id: string, result: WaitResult) {
  const list = waiters.get(id);
  if (!list) return;
  waiters.delete(id);
  for (const resolve of list) resolve(result);
}

// ---------------------------------------------------------------------------
// Sending

function buildForm(item: QueuedUpload) {
  const form = new FormData();
  const f = item.fields;
  form.append("clientUploadId", item.id);
  form.append("albumId", f.albumId);
  form.append("title", f.title);
  form.append("description", f.description);
  form.append("tags", f.tags);
  form.append("takenAt", f.takenAt);
  form.append("latitude", f.latitude);
  form.append("longitude", f.longitude);
  form.append("locationName", f.locationName);
  form.append("width", f.width);
  form.append("height", f.height);
  if (f.kind === "video") {
    form.append("kind", "video");
    form.append("durationMs", f.durationMs);
  }
  if (item.keepDuplicate) form.append("keepDuplicate", "1");
  form.append("file", item.file, item.fileName);
  if (item.thumb) form.append("thumb", item.thumb, "thumb.jpg");
  return form;
}

function send(item: QueuedUpload, onProgress: (ratio: number) => void) {
  return new Promise<{ status: number; body: UploadResponseBody }>((resolve) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/photos");
    xhr.withCredentials = true;
    xhr.timeout = 5 * 60_000;
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && event.total > 0) {
        onProgress(event.loaded / event.total);
      }
    };
    xhr.onload = () => {
      let body: UploadResponseBody = {};
      try {
        body = JSON.parse(xhr.responseText) as UploadResponseBody;
      } catch {
        /* non-JSON error page */
      }
      resolve({ status: xhr.status, body });
    };
    const fail = () => resolve({ status: 0, body: {} });
    xhr.onerror = fail;
    xhr.ontimeout = fail;
    xhr.onabort = fail;
    xhr.send(buildForm(item));
  });
}

let lastNotify = 0;
let pendingNotify = false;

function photosArrived(force = false) {
  pendingNotify = true;
  const now = Date.now();
  if (!force && now - lastNotify < NOTIFY_EVERY_MS) return;
  lastNotify = now;
  pendingNotify = false;
  notifyPhotosChanged();
}

/** Returns false when the loop should stop (offline or logged out). */
async function processItem(item: QueuedUpload): Promise<boolean> {
  await patchItem(item.id, { status: "uploading", error: null });
  emit({ activeId: item.id, progress: 0 });
  await refresh();

  let lastEmit = 0;
  const { status, body } = await send(item, (ratio) => {
    const now = Date.now();
    if (now - lastEmit < 120 && ratio < 1) return;
    lastEmit = now;
    emit({ progress: ratio });
  });
  const outcome = classifyUploadResponse(status, body);
  emit({ activeId: null, progress: null });

  switch (outcome.type) {
    case "done":
      await deleteOne(item.id);
      emit({ doneCount: snapshot.doneCount + 1, networkError: false });
      photosArrived();
      settle(item.id, outcome);
      return true;
    case "duplicate":
      await patchItem(item.id, {
        status: "duplicate",
        duplicate: outcome.duplicate,
        error: outcome.message,
      });
      settle(item.id, outcome);
      return true;
    case "rejected":
      await patchItem(item.id, { status: "failed", error: outcome.message });
      settle(item.id, outcome);
      return true;
    case "auth":
      await patchItem(item.id, { status: "pending", error: outcome.message });
      emit({ pausedForAuth: true });
      settle(item.id, outcome);
      return false;
    case "retry": {
      const attempts = item.attempts + 1;
      emit({ networkError: outcome.network });
      if (!outcome.network && attempts >= MAX_SERVER_ATTEMPTS) {
        await patchItem(item.id, { status: "failed", attempts, error: outcome.message });
        settle(item.id, { type: "rejected", message: outcome.message });
        return true;
      }
      await patchItem(item.id, {
        status: "pending",
        attempts,
        nextAttemptAt: Date.now() + retryDelayMs(attempts),
        error: outcome.message,
      });
      settle(item.id, { type: "queued" });
      // A server hiccup shouldn't block the rest; a dead network should.
      return !outcome.network;
    }
  }
}

let running = false;
let timer: ReturnType<typeof setTimeout> | null = null;

function scheduleWake() {
  if (timer) clearTimeout(timer);
  timer = null;
  const waiting = snapshot.items
    .filter((item) => item.status === "pending")
    .map((item) => item.nextAttemptAt);
  if (waiting.length === 0) return;
  const delay = Math.max(1_000, Math.min(...waiting) - Date.now());
  timer = setTimeout(() => kickUploadQueue(), delay);
}

async function runLoop() {
  emit({ pausedForAuth: false });
  await refresh();
  // Holding the lock means no other tab is sending: "uploading" is stale.
  for (const item of snapshot.items) {
    if (item.status === "uploading") {
      await patchItem(item.id, { status: "pending", nextAttemptAt: 0 });
    }
  }
  await refresh();

  while (navigator.onLine) {
    const next = pickNextUpload(snapshot.items, Date.now());
    if (!next) break;
    const keepGoing = await processItem(next);
    await refresh();
    broadcast();
    if (!keepGoing) break;
  }
  if (pendingNotify) photosArrived(true);
  emit({ online: navigator.onLine });
  scheduleWake();
}

async function withQueueLock(run: () => Promise<void>) {
  const locks = (navigator as Navigator & { locks?: LockManager }).locks;
  if (!locks?.request) return run();
  await locks.request(LOCK_NAME, { ifAvailable: true }, async (lock) => {
    if (lock) await run();
  });
}

export function kickUploadQueue() {
  if (typeof window === "undefined" || running) return;
  running = true;
  void withQueueLock(runLoop)
    .catch((err) => console.error("upload queue", err))
    .finally(() => {
      running = false;
    });
}

async function resetBackoff() {
  for (const item of snapshot.items) {
    if (item.status === "pending" && item.nextAttemptAt > Date.now()) {
      await patchItem(item.id, { nextAttemptAt: 0 });
    }
  }
  await refresh();
}

let started = false;

/** Wire up triggers once per page: online, focus, other tabs, periodic poll. */
export function startUploadQueue() {
  if (started || typeof window === "undefined" || !("indexedDB" in window)) return;
  started = true;
  window.addEventListener("online", () => {
    emit({ online: true });
    // Connection is back: don't sit out the remaining backoff.
    void resetBackoff().then(kickUploadQueue);
  });
  window.addEventListener("offline", () => emit({ online: false }));
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") kickUploadQueue();
  });
  if ("BroadcastChannel" in window) {
    channel = new BroadcastChannel(CHANNEL_NAME);
    channel.onmessage = () => {
      void refresh();
      kickUploadQueue();
    };
  }
  setInterval(() => {
    if (document.visibilityState === "visible") kickUploadQueue();
  }, POLL_MS);
  kickUploadQueue();
}

// ---------------------------------------------------------------------------
// Public actions

let persistAsked = false;

export async function enqueueUpload(upload: NewUpload) {
  const item: QueuedUpload = {
    ...upload,
    id: crypto.randomUUID(),
    createdAt: Date.now(),
    status: "pending",
    attempts: 0,
    nextAttemptAt: 0,
    error: null,
    duplicate: null,
    keepDuplicate: false,
  };
  await writeOne(item);
  if (!persistAsked) {
    persistAsked = true;
    // Ask the browser not to evict queued photos under storage pressure.
    void navigator.storage?.persist?.().catch(() => false);
  }
  await refresh();
  broadcast();
  startUploadQueue();
  kickUploadQueue();
  return item.id;
}

/** Resolves when the item finished, was rejected, or fell back to waiting. */
export function waitForUpload(id: string, timeoutMs = 90_000) {
  return new Promise<WaitResult>((resolve) => {
    const timeout = setTimeout(() => {
      const list = waiters.get(id)?.filter((fn) => fn !== done) ?? [];
      if (list.length) waiters.set(id, list);
      else waiters.delete(id);
      resolve({ type: "queued" });
    }, timeoutMs);
    const done = (result: WaitResult) => {
      clearTimeout(timeout);
      resolve(result);
    };
    waiters.set(id, [...(waiters.get(id) ?? []), done]);
  });
}

async function requeue(id: string, patch: Partial<QueuedUpload> = {}) {
  await patchItem(id, {
    status: "pending",
    attempts: 0,
    nextAttemptAt: 0,
    error: null,
    ...patch,
  });
  await refresh();
  broadcast();
  kickUploadQueue();
}

export const retryUpload = (id: string) => requeue(id);

export const keepDuplicateUpload = (id: string) =>
  requeue(id, { keepDuplicate: true, duplicate: null });

export async function retryAllUploads() {
  for (const item of snapshot.items) {
    if (item.status === "failed" || item.status === "pending") {
      await patchItem(item.id, {
        status: "pending",
        attempts: 0,
        nextAttemptAt: 0,
        error: null,
      });
    }
  }
  await refresh();
  broadcast();
  kickUploadQueue();
}

export async function discardUpload(id: string) {
  if (snapshot.activeId === id) return;
  await deleteOne(id);
  settle(id, { type: "rejected", message: "Verworfen." });
  await refresh();
  broadcast();
}
