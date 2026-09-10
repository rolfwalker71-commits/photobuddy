"use client";

import { useEffect, useState } from "react";
import { AlbumPicker } from "@/components/album-picker";
import { AppHeader } from "@/components/app-header";
import { FloatingDock } from "@/components/floating-dock";
import { UploadForm } from "@/components/upload-form";
import { api } from "@/lib/api";
import { getStoredAlbumId, pickAlbumId, storeAlbumId } from "@/lib/album";
import type { Album } from "@/lib/types";

export default function CameraPage() {
  const [albums, setAlbums] = useState<Album[]>([]);
  const [albumId, setAlbumId] = useState<string | null>(null);

  useEffect(() => {
    void api<{ albums: Album[] }>("/api/albums")
      .then((data) => {
        setAlbums(data.albums);
        const id = pickAlbumId(data.albums, getStoredAlbumId());
        setAlbumId(id);
      })
      .catch(() => {
        setAlbums([]);
        setAlbumId(null);
      });
  }, []);

  function changeAlbum(id: string) {
    storeAlbumId(id);
    setAlbumId(id);
  }

  const currentAlbum = albums.find((a) => a.id === albumId) ?? albums[0];

  return (
    <div className="min-h-dvh pb-28">
      <AppHeader
        title="Foto teilen"
        titleSlot={
          albums.length > 0 ? (
            <AlbumPicker
              albums={albums}
              currentId={albumId ?? currentAlbum?.id ?? null}
              onChange={changeAlbum}
            />
          ) : undefined
        }
        subtitle="Kamera oder mehrere aus der Galerie"
      />
      <main className="mx-auto max-w-lg px-4 py-4">
        <UploadForm albumId={albumId} onAlbumChange={changeAlbum} albums={albums} />
      </main>
      <FloatingDock mode="teilnehmer" shareKey={null} />
    </div>
  );
}
