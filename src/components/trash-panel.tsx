"use client";

import { useEffect, useState } from "react";
import { RotateCcw, Trash2 } from "lucide-react";
import { AlbumPicker } from "@/components/album-picker";
import { getStoredAlbumId, pickAlbumId, storeAlbumId } from "@/lib/album";
import { api } from "@/lib/api";
import { formatAppDateTime } from "@/lib/format-date";
import { notifyPhotosChanged } from "@/lib/photos-sync";
import { previewPhotoUrl } from "@/lib/storage";
import type { Album, Photo } from "@/lib/types";

export function TrashPanel() {
  const [albums, setAlbums] = useState<Album[]>([]);
  const [albumId, setAlbumId] = useState<string | null>(null);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void api<{ albums: Album[] }>("/api/albums")
      .then((data) => {
        setAlbums(data.albums);
        setAlbumId(pickAlbumId(data.albums, getStoredAlbumId()));
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Laden fehlgeschlagen.");
      });
  }, []);

  useEffect(() => {
    if (!albumId) {
      setPhotos([]);
      return;
    }
    void api<{ photos: Photo[] }>(`/api/photos/trash?albumId=${encodeURIComponent(albumId)}`)
      .then((data) => setPhotos(data.photos))
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Papierkorb fehlgeschlagen.");
      });
  }, [albumId]);

  function changeAlbum(id: string) {
    storeAlbumId(id);
    setAlbumId(id);
  }

  async function act(action: "restore" | "purge", ids: string[]) {
    if (!albumId || ids.length === 0) return;
    if (
      action === "purge" &&
      !window.confirm("Endgültig löschen? Das geht nicht zurück.")
    ) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await api("/api/photos/bulk", {
        method: "POST",
        body: JSON.stringify({ action, albumId, photoIds: ids }),
      });
      setPhotos((prev) => prev.filter((photo) => !ids.includes(photo.id)));
      notifyPhotosChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Aktion fehlgeschlagen.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-sm leading-snug text-muted-foreground">
        Gelöschte Fotos bleiben 30 Tage wiederherstellbar. Ältere Einträge
        verschwinden automatisch.
      </p>
      {albums.length > 1 ? (
        <AlbumPicker albums={albums} currentId={albumId} onChange={changeAlbum} />
      ) : null}
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {photos.length === 0 ? (
        <div className="rounded-2xl bg-card p-8 text-center shadow-card ring-1 ring-border">
          <p className="font-medium">Papierkorb ist leer</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {photos.map((photo) => (
            <li
              key={photo.id}
              className="flex items-center gap-3 rounded-2xl bg-card p-3 shadow-card ring-1 ring-border"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={previewPhotoUrl(photo)}
                alt=""
                className="size-16 shrink-0 rounded-xl object-cover"
              />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium leading-snug break-words">
                  {photo.title || (photo.kind === "video" ? "Video" : "Foto")}
                </p>
                <p className="text-[0.7rem] text-muted-foreground">
                  Weggelegt {formatAppDateTime(photo.deleted_at)}
                </p>
              </div>
              <button
                type="button"
                disabled={busy}
                onClick={() => void act("restore", [photo.id])}
                className="inline-flex size-11 items-center justify-center rounded-2xl bg-muted"
                aria-label="Wiederherstellen"
              >
                <RotateCcw className="size-4" />
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void act("purge", [photo.id])}
                className="inline-flex size-11 items-center justify-center rounded-2xl bg-muted text-destructive"
                aria-label="Endgültig löschen"
              >
                <Trash2 className="size-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
