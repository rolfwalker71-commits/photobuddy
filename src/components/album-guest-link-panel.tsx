"use client";

import { useEffect, useState } from "react";
import { Copy, Link2 } from "lucide-react";
import { ShareQr } from "@/components/share-qr";
import { AlbumPicker } from "@/components/album-picker";
import { api } from "@/lib/api";
import { getStoredAlbumId, pickAlbumId, storeAlbumId } from "@/lib/album";
import { getSiteUrl } from "@/lib/env";
import type { Album, ShareLink } from "@/lib/types";

function shareHref(link: ShareLink | null) {
  if (!link?.key) return "";
  return `${getSiteUrl()}/gallery/share?key=${encodeURIComponent(link.key)}`;
}

export function AlbumGuestLinkPanel() {
  const [albums, setAlbums] = useState<Album[]>([]);
  const [albumId, setAlbumId] = useState<string | null>(null);
  const [shareLink, setShareLink] = useState<ShareLink | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void api<{ albums: Album[] }>("/api/albums")
      .then((data) => {
        setAlbums(data.albums);
        const id = pickAlbumId(data.albums, getStoredAlbumId());
        setAlbumId(id);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Laden fehlgeschlagen.");
      });
  }, []);

  useEffect(() => {
    if (!albumId) {
      setShareLink(null);
      return;
    }
    void api<{ shareLink: ShareLink | null }>(`/api/albums/${albumId}/share-link`)
      .then((data) => setShareLink(data.shareLink))
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Link konnte nicht geladen werden.");
      });
  }, [albumId]);

  function changeAlbum(id: string) {
    storeAlbumId(id);
    setAlbumId(id);
    setStatus(null);
  }

  async function copyLink() {
    const href = shareHref(shareLink);
    if (!href) return;
    try {
      await navigator.clipboard.writeText(href);
      setStatus("Link kopiert.");
    } catch {
      setStatus("Kopieren fehlgeschlagen — Link markieren und manuell kopieren.");
    }
  }

  if (albums.length === 0) return null;

  const href = shareHref(shareLink);

  return (
    <section className="space-y-3 rounded-2xl bg-card p-4 shadow-card ring-1 ring-border">
      <h2 className="inline-flex items-center gap-2 text-base font-semibold">
        <Link2 className="size-4" aria-hidden />
        Gäste-Link
      </h2>
      <p className="text-sm leading-snug text-muted-foreground">
        Link für Familie und Freunde ohne Login. Nur ansehen, kommentieren und
        reagieren — nicht bearbeiten.
      </p>
      {albums.length > 1 ? (
        <AlbumPicker albums={albums} currentId={albumId} onChange={changeAlbum} />
      ) : null}
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {href ? (
        <div className="space-y-2">
          <p className="break-all rounded-2xl bg-muted px-3 py-2 text-xs leading-snug">
            {href}
          </p>
          <button
            type="button"
            onClick={() => void copyLink()}
            className="inline-flex h-11 items-center gap-2 rounded-2xl bg-primary px-4 text-sm font-medium text-primary-foreground"
          >
            <Copy className="size-4" aria-hidden />
            Link kopieren
          </button>
          <ShareQr url={href} label="QR-Code Gäste-Link — zum Ausdrucken" />
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          Für dieses Album ist noch kein Gäste-Link hinterlegt. Bitte die
          Administration kontaktieren.
        </p>
      )}
      {status ? <p className="text-sm text-muted-foreground">{status}</p> : null}
    </section>
  );
}
