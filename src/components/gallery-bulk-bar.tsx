"use client";

import { useState } from "react";
import { FolderInput, Globe, MapPin, Tags, Trash2, X } from "lucide-react";
import { api } from "@/lib/api";
import { notifyPhotosChanged } from "@/lib/photos-sync";
import type { Album, Photo } from "@/lib/types";

type GalleryBulkBarProps = {
  albumId: string;
  albums: Album[];
  selected: Photo[];
  onClear: () => void;
  onSelectAll: () => void;
  onDone: () => void;
  /** Shown only when the trip website is configured. */
  onPublish?: () => void;
};

export function GalleryBulkBar({
  albumId,
  albums,
  selected,
  onClear,
  onSelectAll,
  onDone,
  onPublish,
}: GalleryBulkBarProps) {
  const [tags, setTags] = useState("");
  const [place, setPlace] = useState("");
  const [targetAlbum, setTargetAlbum] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ids = selected.map((photo) => photo.id);

  async function run(action: string, extra: Record<string, unknown> = {}) {
    if (ids.length === 0) return;
    setBusy(true);
    setError(null);
    try {
      await api("/api/photos/bulk", {
        method: "POST",
        body: JSON.stringify({
          action,
          albumId,
          photoIds: ids,
          ...extra,
        }),
      });
      notifyPhotosChanged();
      onClear();
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Aktion fehlgeschlagen.");
    } finally {
      setBusy(false);
    }
  }

  async function geocodeAndSetPlace() {
    const query = place.trim();
    if (!query) return;
    setBusy(true);
    setError(null);
    try {
      const data = await api<{
        results: Array<{ latitude: number; longitude: number; label: string }>;
      }>(`/api/geocode/search?q=${encodeURIComponent(query)}`);
      const hit = data.results[0];
      await run("location", {
        location_name: hit?.label ?? query,
        latitude: hit?.latitude ?? null,
        longitude: hit?.longitude ?? null,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ort fehlgeschlagen.");
      setBusy(false);
    }
  }

  return (
    <div
      className="pointer-events-none fixed inset-x-0 z-[36] px-4"
      style={{
        bottom: "calc(4.75rem + max(0.75rem, env(safe-area-inset-bottom)))",
      }}
    >
      <div className="pointer-events-auto mx-auto max-w-lg space-y-2 rounded-2xl bg-card p-3 shadow-dock ring-1 ring-border">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-medium">
            {selected.length} ausgewählt
          </p>
          <div className="flex gap-1">
            <button
              type="button"
              onClick={onSelectAll}
              className="inline-flex h-9 items-center rounded-xl bg-muted px-2.5 text-xs font-medium"
            >
              Alle
            </button>
            <button
              type="button"
              onClick={onClear}
              className="inline-flex h-9 items-center rounded-xl bg-muted px-2.5 text-xs font-medium"
            >
              Leeren
            </button>
            <button
              type="button"
              onClick={onDone}
              className="inline-flex size-9 items-center justify-center rounded-xl bg-muted"
              aria-label="Auswahl beenden"
            >
              <X className="size-4" />
            </button>
          </div>
        </div>
        <div className="flex gap-1.5">
          <input
            className="h-11 min-w-0 flex-1 rounded-2xl border border-border bg-background px-3 text-sm"
            placeholder="Tags, kommagetrennt"
            value={tags}
            onChange={(event) => setTags(event.target.value)}
          />
          <button
            type="button"
            disabled={busy || !tags.trim()}
            onClick={() => void run("tags", { tags })}
            className="inline-flex h-11 items-center gap-1 rounded-2xl bg-muted px-3 text-sm font-medium disabled:opacity-50"
          >
            <Tags className="size-4" />
            Tag
          </button>
        </div>
        <div className="flex gap-1.5">
          <input
            className="h-11 min-w-0 flex-1 rounded-2xl border border-border bg-background px-3 text-sm"
            placeholder="Ort setzen"
            value={place}
            onChange={(event) => setPlace(event.target.value)}
          />
          <button
            type="button"
            disabled={busy || !place.trim()}
            onClick={() => void geocodeAndSetPlace()}
            className="inline-flex h-11 items-center gap-1 rounded-2xl bg-muted px-3 text-sm font-medium disabled:opacity-50"
          >
            <MapPin className="size-4" />
            Ort
          </button>
        </div>
        {albums.length > 1 ? (
          <div className="flex gap-1.5">
            <select
              className="h-11 min-w-0 flex-1 rounded-2xl border border-border bg-background px-3 text-sm"
              value={targetAlbum}
              onChange={(event) => setTargetAlbum(event.target.value)}
            >
              <option value="">In anderes Album…</option>
              {albums
                .filter((album) => album.id !== albumId)
                .map((album) => (
                  <option key={album.id} value={album.id}>
                    {album.name}
                  </option>
                ))}
            </select>
            <button
              type="button"
              disabled={busy || !targetAlbum}
              onClick={() => void run("move", { targetAlbumId: targetAlbum })}
              className="inline-flex h-11 items-center gap-1 rounded-2xl bg-muted px-3 text-sm font-medium disabled:opacity-50"
            >
              <FolderInput className="size-4" />
              Verschieben
            </button>
          </div>
        ) : null}
        {onPublish ? (
          <button
            type="button"
            disabled={busy || selected.length === 0}
            onClick={onPublish}
            className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-2xl bg-primary text-sm font-medium text-primary-foreground disabled:opacity-50"
          >
            <Globe className="size-4" />
            Auf die Webseite
          </button>
        ) : null}
        <button
          type="button"
          disabled={busy}
          onClick={() => {
            if (!window.confirm("Ausgewählte Fotos in den Papierkorb legen?")) {
              return;
            }
            void run("delete");
          }}
          className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-2xl bg-muted text-sm font-medium text-destructive disabled:opacity-50"
        >
          <Trash2 className="size-4" />
          In den Papierkorb
        </button>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
      </div>
    </div>
  );
}
