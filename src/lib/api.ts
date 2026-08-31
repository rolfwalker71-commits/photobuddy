export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  if (init?.body && !(init.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  const res = await fetch(path, {
    ...init,
    headers,
    credentials: "include",
  });
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) {
    throw new Error(data.error || `Anfrage fehlgeschlagen (${res.status}).`);
  }
  return data;
}

export function withParams(
  path: string,
  params: { key?: string | null; albumId?: string | null },
) {
  const qIndex = path.indexOf("?");
  const base = qIndex >= 0 ? path.slice(0, qIndex) : path;
  const search = new URLSearchParams(qIndex >= 0 ? path.slice(qIndex + 1) : "");
  if (params.key) search.set("key", params.key);
  if (params.albumId) search.set("albumId", params.albumId);
  const query = search.toString();
  return query ? `${base}?${query}` : base;
}

export function withKey(path: string, shareKey: string | null, albumId?: string | null) {
  return withParams(path, { key: shareKey, albumId });
}
