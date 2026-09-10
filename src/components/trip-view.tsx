"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Download, MoonStar, Sparkles } from "lucide-react";
import { AlbumPicker } from "@/components/album-picker";
import { AppHeader } from "@/components/app-header";
import { FloatingDock } from "@/components/floating-dock";
import { PhotoFiltersSheet } from "@/components/photo-filters";
import { PhotoGrid } from "@/components/photo-grid";
import { PhotoMapDynamic } from "@/components/photo-map-dynamic";
import { PhotoTimeline } from "@/components/photo-timeline";
import { PushEnable } from "@/components/push-enable";
import { Slideshow, slideshowPhotos } from "@/components/slideshow";
import { useTripData } from "@/hooks/use-trip-data";
import { getStoredAlbumId, pickAlbumId, storeAlbumId } from "@/lib/album";
import { api, withKey } from "@/lib/api";
import { formatDateRange } from "@/lib/album-label";
import { emptyFilters, filterPhotos } from "@/lib/filters";
import { formatAppDate, formatAppDateTime } from "@/lib/format-date";
import { getGuestSessionId } from "@/lib/guest";
import { readLocalLastSeen, writeLocalLastSeen } from "@/lib/last-seen";
import { notifyPhotosChanged } from "@/lib/photos-sync";
import type { Photo, PhotoFilters, Profile, ViewerMode } from "@/lib/types";

type TripViewProps = {
  mode: ViewerMode;
  shareKey: string | null;
  view: "grid" | "map" | "timeline";
};

export function TripView({ mode, shareKey, view }: TripViewProps) {
  const [albumId, setAlbumId] = useState<string | null>(() =>
    mode === "guest" ? null : getStoredAlbumId(),
  );

  const {
    photos,
    profiles,
    tags: albumTags,
    albums,
    currentAlbum,
    profileById,
    loading,
    error,
    shareLabel,
    dayNotes,
    setDayNotes,
    lastSeenAt,
    patchPhoto,
  } = useTripData(mode, shareKey, mode === "guest" ? null : albumId);

  const [me, setMe] = useState<Profile | null>(null);
  const [filters, setFilters] = useState<PhotoFilters>(emptyFilters);
  const [openFilters, setOpenFilters] = useState(false);
  const [slideshowOpen, setSlideshowOpen] = useState(false);
  const [zipBusy, setZipBusy] = useState(false);
  const [compareSeen, setCompareSeen] = useState<string | null>(null);
  const markedRef = useRef(false);
  const guestDefaulted = useRef(false);

  useEffect(() => {
    if (mode === "guest" || !currentAlbum) return;
    if (currentAlbum.id !== albumId) {
      setAlbumId(currentAlbum.id);
      storeAlbumId(currentAlbum.id);
    }
  }, [albumId, currentAlbum, mode]);

  useEffect(() => {
    if (mode !== "teilnehmer") return;
    void api<{ user: Profile }>("/api/auth/me")
      .then((data) => setMe(data.user))
      .catch(() => setMe(null));
  }, [mode]);

  useEffect(() => {
    guestDefaulted.current = false;
    markedRef.current = false;
    setFilters(emptyFilters);
  }, [currentAlbum?.id]);

  useEffect(() => {
    if (!currentAlbum) return;
    const local = readLocalLastSeen(currentAlbum.id);
    const previous = lastSeenAt ?? local;
    setCompareSeen(previous);
    if (previous) writeLocalLastSeen(currentAlbum.id, previous);
    else markedRef.current = false;
  }, [currentAlbum, lastSeenAt]);

  useEffect(() => {
    if (
      mode === "guest" &&
      !guestDefaulted.current &&
      photos.some((photo) => photo.is_highlight)
    ) {
      guestDefaulted.current = true;
      setFilters((prev) => ({ ...prev, onlyHighlights: true }));
    }
  }, [mode, photos]);

  async function markSeen() {
    if (!currentAlbum || markedRef.current) return;
    markedRef.current = true;
    const now = new Date().toISOString();
    writeLocalLastSeen(currentAlbum.id, now);
    try {
      await api(withKey(`/api/albums/${currentAlbum.id}/visit`, shareKey), {
        method: "POST",
        body: JSON.stringify({
          guest_session_id: mode === "guest" ? getGuestSessionId() : undefined,
        }),
      });
    } catch {
      /* local stamp is enough */
    }
  }

  useEffect(() => {
    if (!currentAlbum) return;
    const onLeave = () => {
      void markSeen();
    };
    const onHidden = () => {
      if (document.visibilityState === "hidden") void markSeen();
    };
    window.addEventListener("pagehide", onLeave);
    document.addEventListener("visibilitychange", onHidden);
    return () => {
      window.removeEventListener("pagehide", onLeave);
      document.removeEventListener("visibilitychange", onHidden);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentAlbum?.id, mode, shareKey]);

  const visible = useMemo(
    () => filterPhotos(photos, filters, { lastSeenAt: compareSeen }),
    [photos, filters, compareSeen],
  );

  const newCount = useMemo(
    () =>
      compareSeen
        ? photos.filter((photo) => photo.created_at > compareSeen).length
        : 0,
    [photos, compareSeen],
  );
  const highlightCount = useMemo(
    () => photos.filter((photo) => photo.is_highlight).length,
    [photos],
  );

  const showPhotos = useMemo(() => slideshowPhotos(photos), [photos]);

  const title =
    mode === "guest"
      ? shareLabel || currentAlbum?.name || "Gäste-Galerie"
      : currentAlbum?.name || "Photobuddy";
  const filterDates =
    filters.dateFrom && filters.dateTo
      ? formatDateRange(filters.dateFrom, filters.dateTo)
      : filters.dateFrom
        ? formatAppDate(filters.dateFrom)
        : filters.dateTo
          ? formatAppDate(filters.dateTo)
          : null;
  const viewLabel =
    view === "map"
      ? "Karte"
      : view === "timeline"
        ? "Timeline"
        : `${visible.length} Foto${visible.length === 1 ? "" : "s"}`;
  const subtitle = filterDates ? `${viewLabel} · ${filterDates}` : viewLabel;

  function changeAlbum(id: string) {
    storeAlbumId(id);
    setAlbumId(pickAlbumId(albums, id));
  }

  function setChip(next: "all" | "highlights" | "new") {
    const onlyHighlights = next === "highlights";
    const onlyNew = next === "new";
    setFilters((prev) => ({ ...prev, onlyHighlights, onlyNew }));
    if (next === "new") void markSeen();
  }

  async function toggleHighlight(photo: Photo) {
    if (mode !== "teilnehmer") return;
    try {
      const data = await api<{ photo: Photo }>(
        `/api/photos/${photo.id}/highlight`,
        {
          method: "POST",
          body: JSON.stringify({ is_highlight: !photo.is_highlight }),
        },
      );
      patchPhoto(data.photo);
      notifyPhotosChanged();
    } catch {
      /* keep current */
    }
  }

  async function downloadZip() {
    if (!currentAlbum) return;
    setZipBusy(true);
    try {
      const useFilter = highlightCount === 0 && visible.length > 0;
      const res = await fetch(
        withKey(`/api/albums/${currentAlbum.id}/zip`, shareKey),
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            photo_ids: useFilter ? visible.map((photo) => photo.id) : undefined,
          }),
        },
      );
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error || "Download fehlgeschlagen.");
      }
      const blob = await res.blob();
      const href = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = href;
      link.download = "Oma-Auswahl.zip";
      link.click();
      URL.revokeObjectURL(href);
    } catch {
      /* ignore */
    } finally {
      setZipBusy(false);
    }
  }

  const chip =
    "h-full min-h-0 self-stretch rounded-full px-3 text-xs font-medium leading-none";
  const chipActive = "bg-card text-foreground shadow-sm";
  const chipIdle = "text-muted-foreground";

  return (
    <div className="min-h-dvh pb-28">
      <AppHeader
        title={title}
        titleSlot={
          mode === "teilnehmer" ? (
            <AlbumPicker
              albums={albums}
              currentId={currentAlbum?.id ?? albumId}
              onChange={changeAlbum}
            />
          ) : undefined
        }
        subtitle={subtitle}
        filters={filters}
        onOpenFilters={() => setOpenFilters(true)}
      />
      <main className="mx-auto max-w-5xl space-y-4 px-4 py-4">
        {currentAlbum && photos.length > 0 ? (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setSlideshowOpen(true)}
                className="inline-flex h-11 min-w-0 flex-1 items-center justify-center gap-2 rounded-2xl bg-primary px-4 text-sm font-semibold text-primary-foreground sm:flex-none"
              >
                <MoonStar className="size-4" aria-hidden />
                Heute Abend
              </button>
              <button
                type="button"
                disabled={zipBusy || visible.length === 0}
                onClick={() => void downloadZip()}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-muted px-4 text-sm font-medium disabled:opacity-50"
              >
                <Download className="size-4" aria-hidden />
                Oma-Auswahl
              </button>
            </div>
            <div
              className="flex h-10 min-h-10 rounded-full bg-muted p-0.5"
              role="tablist"
              aria-label="Galeriefilter"
            >
              <button
                type="button"
                role="tab"
                aria-selected={!filters.onlyHighlights && !filters.onlyNew}
                className={`${chip} flex-1 ${
                  !filters.onlyHighlights && !filters.onlyNew
                    ? chipActive
                    : chipIdle
                }`}
                onClick={() => setChip("all")}
              >
                Alle
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={filters.onlyHighlights}
                className={`${chip} flex-1 ${
                  filters.onlyHighlights ? chipActive : chipIdle
                }`}
                onClick={() => setChip("highlights")}
              >
                <span className="inline-flex items-center justify-center gap-1">
                  <Sparkles className="size-3.5" aria-hidden />
                  Highlights
                  {highlightCount > 0 ? ` ${highlightCount}` : ""}
                </span>
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={filters.onlyNew}
                className={`${chip} flex-1 ${
                  filters.onlyNew ? chipActive : chipIdle
                }`}
                onClick={() => setChip("new")}
              >
                Neu{newCount > 0 ? ` ${newCount}` : ""}
              </button>
            </div>
            {filters.onlyNew && compareSeen ? (
              <p className="text-xs leading-snug text-muted-foreground">
                Neu seit {formatAppDateTime(compareSeen)}
              </p>
            ) : null}
          </div>
        ) : null}

        {mode === "guest" && currentAlbum ? (
          <PushEnable
            mode={mode}
            shareKey={shareKey}
            albumId={currentAlbum.id}
            compact
          />
        ) : null}

        {loading ? (
          <p className="py-16 text-center text-sm text-muted-foreground">
            Galerie wird geladen…
          </p>
        ) : error ? (
          <div className="rounded-2xl bg-card p-8 text-center shadow-card ring-1 ring-border">
            <p className="font-medium text-destructive">{error}</p>
          </div>
        ) : mode === "teilnehmer" && albums.length === 0 ? (
          <div className="rounded-2xl bg-card p-8 text-center shadow-card ring-1 ring-border">
            <p className="font-medium">Noch keinem Album zugeordnet</p>
            <p className="mt-1 text-sm text-muted-foreground leading-snug">
              Ein Admin kann dich unter Einstellungen → Alben hinzufügen.
            </p>
          </div>
        ) : view === "map" ? (
          <PhotoMapDynamic
            photos={visible}
            profiles={profileById}
            mode={mode}
            shareKey={shareKey}
            lastSeenAt={compareSeen}
            focusDay={
              filters.dateFrom && filters.dateFrom === filters.dateTo
                ? filters.dateFrom
                : null
            }
          />
        ) : view === "timeline" ? (
          <PhotoTimeline
            photos={visible}
            profiles={profileById}
            mode={mode}
            shareKey={shareKey}
            albumId={currentAlbum?.id}
            dayNotes={dayNotes}
            lastSeenAt={compareSeen}
            currentUserId={me?.id ?? null}
            isAdmin={me?.role === "admin"}
            onNotesChange={setDayNotes}
            onToggleHighlight={toggleHighlight}
          />
        ) : (
          <PhotoGrid
            photos={visible}
            profiles={profileById}
            mode={mode}
            shareKey={shareKey}
            lastSeenAt={compareSeen}
            onToggleHighlight={toggleHighlight}
          />
        )}
      </main>
      <PhotoFiltersSheet
        open={openFilters}
        onClose={() => setOpenFilters(false)}
        filters={filters}
        onChange={setFilters}
        profiles={profiles}
        albumTags={albumTags}
      />
      <Slideshow
        photos={showPhotos}
        open={slideshowOpen}
        onClose={() => setSlideshowOpen(false)}
      />
      <FloatingDock mode={mode} shareKey={shareKey} />
    </div>
  );
}
