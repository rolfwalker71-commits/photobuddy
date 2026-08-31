"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { BookImage, Copy, RefreshCw } from "lucide-react";
import { api } from "@/lib/api";
import { getSiteUrl } from "@/lib/env";
import type { Album, Profile, ShareLink } from "@/lib/types";

export function AdminAlbumsPanel() {
  const router = useRouter();
  const [albums, setAlbums] = useState<Album[]>([]);
  const [users, setUsers] = useState<Profile[]>([]);
  const [name, setName] = useState("");
  const [createMembers, setCreateMembers] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [renameId, setRenameId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");

  async function load() {
    const session = await api<{ user: Profile }>("/api/auth/me");
    if (session.user.role !== "admin") {
      router.replace("/settings");
      return;
    }
    const [albumData, userData] = await Promise.all([
      api<{ albums: Album[] }>("/api/albums"),
      api<{ users: Profile[] }>("/api/admin/users"),
    ]);
    setAlbums(albumData.albums);
    setUsers(userData.users);
  }

  useEffect(() => {
    void load().catch((err) => {
      setError(err instanceof Error ? err.message : "Laden fehlgeschlagen.");
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  function flash(message: string) {
    setStatus(message);
    setError(null);
  }

  function shareHref(link: ShareLink | null) {
    if (!link) return "";
    return `${getSiteUrl()}/gallery/share?key=${encodeURIComponent(link.key)}`;
  }

  async function createAlbum(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const data = await api<{ album: Album }>("/api/albums", {
        method: "POST",
        body: JSON.stringify({
          name: name.trim(),
          member_ids: createMembers,
        }),
      });
      if (data.album) setAlbums((prev) => [...prev, data.album]);
      setName("");
      setCreateMembers([]);
      flash("Album angelegt.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Anlegen fehlgeschlagen.");
    } finally {
      setBusy(false);
    }
  }

  async function saveName(album: Album) {
    setBusy(true);
    setError(null);
    try {
      const data = await api<{ album: Album }>(`/api/albums/${album.id}`, {
        method: "PATCH",
        body: JSON.stringify({ name: renameValue.trim() }),
      });
      setAlbums((prev) =>
        prev.map((item) => (item.id === album.id ? data.album : item)),
      );
      setRenameId(null);
      flash("Name gespeichert.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Speichern fehlgeschlagen.");
    } finally {
      setBusy(false);
    }
  }

  async function removeAlbum(album: Album) {
    if (!window.confirm(`„${album.name}“ wirklich löschen?`)) return;
    setBusy(true);
    setError(null);
    try {
      await api(`/api/albums/${album.id}`, { method: "DELETE" });
      setAlbums((prev) => prev.filter((item) => item.id !== album.id));
      flash("Album gelöscht.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Löschen fehlgeschlagen.");
    } finally {
      setBusy(false);
    }
  }

  async function saveMembers(album: Album, userIds: string[]) {
    setBusy(true);
    setError(null);
    try {
      const data = await api<{ album: Album }>(`/api/albums/${album.id}/members`, {
        method: "PUT",
        body: JSON.stringify({ user_ids: userIds }),
      });
      setAlbums((prev) =>
        prev.map((item) => (item.id === album.id ? data.album : item)),
      );
      flash("Teilnehmer gespeichert.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Speichern fehlgeschlagen.");
    } finally {
      setBusy(false);
    }
  }

  function toggleMember(album: Album, userId: string) {
    const next = album.member_ids.includes(userId)
      ? album.member_ids.filter((id) => id !== userId)
      : [...album.member_ids, userId];
    void saveMembers(album, next);
  }

  async function rotateLink(album: Album) {
    if (
      album.share_link &&
      !window.confirm("Den Gäste-Link erneuern? Der alte Link funktioniert danach nicht mehr.")
    ) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const data = await api<{ album: Album }>(`/api/albums/${album.id}/share-link`, {
        method: "POST",
        body: JSON.stringify({ action: "rotate" }),
      });
      setAlbums((prev) =>
        prev.map((item) => (item.id === album.id ? data.album : item)),
      );
      flash("Gäste-Link erneuert.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Link fehlgeschlagen.");
    } finally {
      setBusy(false);
    }
  }

  async function toggleLink(album: Album) {
    if (!album.share_link) return;
    setBusy(true);
    try {
      const data = await api<{ album: Album }>(`/api/albums/${album.id}/share-link`, {
        method: "PATCH",
        body: JSON.stringify({ is_active: !album.share_link.is_active }),
      });
      setAlbums((prev) =>
        prev.map((item) => (item.id === album.id ? data.album : item)),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Link fehlgeschlagen.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <form
        onSubmit={(event) => void createAlbum(event)}
        className="space-y-3 rounded-2xl bg-card p-4 shadow-card ring-1 ring-border"
      >
        <div className="flex items-center gap-2">
          <BookImage className="size-4" aria-hidden />
          <h2 className="text-base font-semibold">Album anlegen</h2>
        </div>
        <label className="block space-y-1.5">
          <span className="text-sm font-medium">Name</span>
          <input
            required
            className="h-11 w-full rounded-2xl border border-border bg-background px-3 text-sm"
            placeholder="z. B. Sommer 2026"
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </label>
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">Wer darf sehen und hochladen?</legend>
          <ul className="space-y-1">
            {users.map((user) => (
              <li key={user.id}>
                <label className="flex min-h-11 items-center gap-3 rounded-2xl bg-background px-3 ring-1 ring-border">
                  <input
                    type="checkbox"
                    checked={createMembers.includes(user.id)}
                    onChange={() =>
                      setCreateMembers((prev) =>
                        prev.includes(user.id)
                          ? prev.filter((id) => id !== user.id)
                          : [...prev, user.id],
                      )
                    }
                  />
                  <span className="text-sm leading-snug break-words">
                    {user.display_name}
                    <span className="text-muted-foreground">
                      {user.role === "admin" ? " · Admin" : ""}
                    </span>
                  </span>
                </label>
              </li>
            ))}
          </ul>
        </fieldset>
        <button
          type="submit"
          disabled={busy}
          className="inline-flex h-11 w-full items-center justify-center rounded-2xl bg-primary text-sm font-medium text-primary-foreground disabled:opacity-60"
        >
          Album anlegen
        </button>
      </form>

      <section className="space-y-3">
        <h2 className="px-1 text-base font-semibold">Alben</h2>
        <ul className="space-y-3">
          {albums.map((album) => {
            const href = shareHref(album.share_link);
            const renaming = renameId === album.id;
            return (
              <li
                key={album.id}
                className="space-y-3 rounded-2xl bg-card p-4 shadow-card ring-1 ring-border"
              >
                {renaming ? (
                  <div className="flex flex-col gap-2">
                    <input
                      className="h-11 w-full rounded-2xl border border-border bg-background px-3 text-sm"
                      value={renameValue}
                      onChange={(event) => setRenameValue(event.target.value)}
                    />
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void saveName(album)}
                        className="inline-flex h-11 items-center rounded-2xl bg-primary px-4 text-sm font-medium text-primary-foreground"
                      >
                        Speichern
                      </button>
                      <button
                        type="button"
                        onClick={() => setRenameId(null)}
                        className="inline-flex h-11 items-center rounded-2xl bg-muted px-4 text-sm font-medium"
                      >
                        Abbrechen
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-medium leading-snug break-words">
                        {album.name}
                      </p>
                      <p className="mt-0.5 text-sm text-muted-foreground">
                        {album.photo_count} Foto{album.photo_count === 1 ? "" : "s"}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setRenameId(album.id);
                          setRenameValue(album.name);
                        }}
                        className="inline-flex h-11 items-center rounded-2xl bg-muted px-3 text-sm font-medium"
                      >
                        Umbenennen
                      </button>
                      <button
                        type="button"
                        disabled={busy || albums.length < 2}
                        onClick={() => void removeAlbum(album)}
                        className="inline-flex h-11 items-center rounded-2xl bg-muted px-3 text-sm font-medium text-destructive disabled:opacity-50"
                      >
                        Löschen
                      </button>
                    </div>
                  </div>
                )}

                <fieldset className="space-y-2">
                  <legend className="text-sm font-medium">Teilnehmer</legend>
                  <ul className="space-y-1">
                    {users.map((user) => (
                      <li key={user.id}>
                        <label className="flex min-h-11 items-center gap-3 rounded-2xl bg-background px-3 ring-1 ring-border">
                          <input
                            type="checkbox"
                            checked={album.member_ids.includes(user.id)}
                            disabled={busy}
                            onChange={() => toggleMember(album, user.id)}
                          />
                          <span className="text-sm leading-snug break-words">
                            {user.display_name}
                            <span className="text-muted-foreground">
                              {user.role === "admin" ? " · Admin" : ""}
                            </span>
                          </span>
                        </label>
                      </li>
                    ))}
                  </ul>
                  <p className="text-sm text-muted-foreground leading-snug">
                    Admins sehen alle Alben. Häkchen steuern, wer hochladen darf
                    und welche Alben Teilnehmer sehen.
                  </p>
                </fieldset>

                <div className="space-y-2 rounded-2xl bg-background p-3 ring-1 ring-border">
                  <p className="text-sm font-medium">Gäste-Link</p>
                  {href ? (
                    <p className="break-all text-xs text-muted-foreground">{href}</p>
                  ) : (
                    <p className="text-sm text-muted-foreground">Noch kein Link.</p>
                  )}
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={!href}
                      onClick={() => void navigator.clipboard.writeText(href)}
                      className="inline-flex h-11 items-center gap-2 rounded-2xl bg-muted px-3 text-sm disabled:opacity-50"
                    >
                      <Copy className="size-4" aria-hidden />
                      Kopieren
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void rotateLink(album)}
                      className="inline-flex h-11 items-center gap-2 rounded-2xl bg-muted px-3 text-sm"
                    >
                      <RefreshCw className="size-4" aria-hidden />
                      {album.share_link ? "Erneuern" : "Erstellen"}
                    </button>
                    {album.share_link ? (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void toggleLink(album)}
                        className="inline-flex h-11 items-center rounded-2xl bg-muted px-3 text-sm"
                      >
                        {album.share_link.is_active ? "Deaktivieren" : "Aktivieren"}
                      </button>
                    ) : null}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {status ? <p className="text-sm text-muted-foreground">{status}</p> : null}
    </div>
  );
}
