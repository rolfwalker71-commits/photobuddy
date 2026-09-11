"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { Check, CheckSquare, Download, MoonStar, PartyPopper, Sparkles, Trash2, X } from "lucide-react";
import { GalleryBulkBar } from "@/components/gallery-bulk-bar";
import { AlbumPicker } from "@/components/album-picker";
import { AppHeader } from "@/components/app-header";
import { DownloadZipDialog } from "@/components/download-zip-dialog";
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
import { appHref } from "@/lib/paths";
import { photoDayKey } from "@/lib/chapters";
import { getGuestSessionId } from "@/lib/guest";
import { isPhotoNew, readLocalLastSeen, writeLocalLastSeen } from "@/lib/last-seen";
import { notifyPhotosChanged } from "@/lib/photos-sync";
import type { Photo, PhotoFilters, Profile, ViewerMode } from "@/lib/types";
import { filenameFromDisposition } from "@/lib/zip-download";

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
    voiceNotes,
    setVoiceNotes,
    lastSeenAt,
    patchPhoto,
    reload,
  } = useTripData(mode, shareKey, mode === "guest" ? null : albumId);

  const [me, setMe] = useState<Profile | null>(null);
  const [filters, setFilters] = useState<PhotoFilters>(emptyFilters);
  const [openFilters, setOpenFilters] = useState(false);
  const [slideshowOpen, setSlideshowOpen] = useState(false);
  const [zipOpen, setZipOpen] = useState(false);
  const [zipBusy, setZipBusy] = useState(false);
  const [zipError, setZipError] = useState<string | null>(null);
  const [compareSeen, setCompareSeen] = useState<string | null>(null);
  const [selecting, setSelecting] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [newBannerHidden, setNewBannerHidden] = useState(false);
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
    setNewBannerHidden(false);
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

  const viewerId = mode === "teilnehmer" ? (me?.id ?? null) : null;
  const visible = useMemo(
    () => filterPhotos(photos, filters, { lastSeenAt: compareSeen, viewerId }),
    [photos, filters, compareSeen, viewerId],
  );

  const newCount = useMemo(
    () => photos.filter((photo) => isPhotoNew(photo, compareSeen, viewerId)).length,
    [photos, compareSeen, viewerId],
  );
  const highlightCount = useMemo(
    () => photos.filter((photo) => photo.is_highlight).length,
    [photos],
  );

  const showPhotos = useMemo(() => slideshowPhotos(photos), [photos]);
  const duplicateIds = useMemo(() => {
    const counts = new Map<string, number>();
    for (const photo of photos) {
      if (!photo.content_hash) continue;
      counts.set(photo.content_hash, (counts.get(photo.content_hash) ?? 0) + 1);
    }
    const ids = new Set<string>();
    for (const photo of photos) {
      if (photo.content_hash && (counts.get(photo.content_hash) ?? 0) > 1) {
        ids.add(photo.id);
      }
    }
    return ids;
  }, [photos]);
  const selectedPhotos = useMemo(
    () => visible.filter((photo) => selectedIds.has(photo.id)),
    [visible, selectedIds],
  );

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
        : `${visible.length} Aufnahme${visible.length === 1 ? "" : "n"}`;
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

  async function downloadZip(input: {
    uploaderIds: string[];
    from: string;
    to: string;
    filename: string;
  }) {
    if (!currentAlbum) return;
    setZipBusy(true);
    setZipError(null);
    try {
      const res = await fetch(
        withKey(`/api/albums/${currentAlbum.id}/zip`, shareKey),
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            uploaderIds: input.uploaderIds,
            from: input.from || undefined,
            to: input.to || undefined,
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
      link.download = filenameFromDisposition(
        res.headers.get("Content-Disposition"),
        input.filename,
      );
      link.click();
      URL.revokeObjectURL(href);
      setZipOpen(false);
    } catch (err) {
      setZipError(
        err instanceof Error ? err.message : "Download fehlgeschlagen.",
      );
    } finally {
      setZipBusy(false);
    }
  }

  const chip =
    "h-full min-h-0 self-stretch rounded-full px-3 text-xs font-medium leading-none";
  const chipActive = "bg-card text-foreground shadow-sm";
  const chipIdle = "text-muted-foreground";
  const action =
    "inline-flex h-11 min-h-11 min-w-11 flex-1 items-center justify-center gap-0 rounded-2xl px-2 text-sm font-medium md:min-w-0 md:flex-none md:gap-2 md:px-4";
  const actionIcon = "size-5 shrink-0 md:size-4";
  const actionLabel = "sr-only md:not-sr-only";

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
            <div className="flex flex-nowrap items-center gap-1.5 overflow-x-auto md:flex-wrap md:overflow-visible md:gap-2">
              <button
                type="button"
                onClick={() => setSlideshowOpen(true)}
                className={`${action} bg-primary font-semibold text-primary-foreground`}
                aria-label="Heute Abend"
                title="Heute Abend"
              >
                <MoonStar className={actionIcon} aria-hidden />
                <span className={actionLabel}>Heute Abend</span>
              </button>
              <button
                type="button"
                disabled={zipBusy || photos.length === 0}
                onClick={() => {
                  setZipError(null);
                  setZipOpen(true);
                }}
                className={`${action} bg-muted disabled:opacity-50`}
                aria-label="Download"
                title="Download"
              >
                <Download className={actionIcon} aria-hidden />
                <span className={actionLabel}>Download</span>
              </button>
              <Link
                href={appHref(mode, shareKey, "recap")}
                className={`${action} bg-muted`}
                aria-label="Rückblick"
                title="Rückblick"
              >
                <PartyPopper className={actionIcon} aria-hidden />
                <span className={actionLabel}>Rückblick</span>
              </Link>
              {mode === "teilnehmer" ? (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      setSelecting((prev) => !prev);
                      setSelectedIds(new Set());
                    }}
                    className={`${action} ${
                      selecting
                        ? "bg-primary/15 text-primary"
                        : "bg-muted"
                    }`}
                    aria-pressed={selecting}
                    aria-label={selecting ? "Fertig" : "Auswählen"}
                    title={selecting ? "Fertig" : "Auswählen"}
                  >
                    {selecting ? (
                      <Check className={actionIcon} aria-hidden />
                    ) : (
                      <CheckSquare className={actionIcon} aria-hidden />
                    )}
                    <span className={actionLabel}>
                      {selecting ? "Fertig" : "Auswählen"}
                    </span>
                  </button>
                  <Link
                    href={appHref(mode, shareKey, "trash")}
                    className={`${action} bg-muted`}
                    aria-label="Papierkorb"
                    title="Papierkorb"
                  >
                    <Trash2 className={actionIcon} aria-hidden />
                    <span className={actionLabel}>Papierkorb</span>
                  </Link>
                </>
              ) : null}
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
            {newCount > 0 && compareSeen && !filters.onlyNew && !newBannerHidden ? (
              <div className="flex items-stretch overflow-hidden rounded-2xl bg-primary/10 ring-1 ring-primary/25">
                <button
                  type="button"
                  onClick={() => setChip("new")}
                  className="flex min-h-12 min-w-0 flex-1 items-center gap-3 px-4 py-2 text-left"
                >
                  <Sparkles className="size-5 shrink-0 text-primary" aria-hidden />
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold leading-snug">
                      {newCount} neue Aufnahme{newCount === 1 ? "" : "n"} seit
                      deinem letzten Besuch
                    </span>
                    <span className="block text-xs leading-snug text-muted-foreground">
                      {formatAppDateTime(compareSeen)} · antippen zum Anzeigen
                    </span>
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setNewBannerHidden(true)}
                  className="flex w-11 shrink-0 items-center justify-center text-muted-foreground"
                  aria-label="Hinweis ausblenden"
                >
                  <X className="size-4" aria-hidden />
                </button>
              </div>
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
            viewerId={viewerId}
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
            voiceNotes={voiceNotes}
            lastSeenAt={compareSeen}
            currentUserId={me?.id ?? null}
            isAdmin={me?.role === "admin"}
            onNotesChange={setDayNotes}
            onVoiceNotesChange={setVoiceNotes}
            onToggleHighlight={toggleHighlight}
            duplicateIds={duplicateIds}
            onShiftDay={
              mode === "teilnehmer" && currentAlbum
                ? async (day, hours) => {
                    const ids = visible
                      .filter((photo) => photoDayKey(photo) === day)
                      .map((photo) => photo.id);
                    if (ids.length === 0) return;
                    await api("/api/photos/bulk", {
                      method: "POST",
                      body: JSON.stringify({
                        action: "shift",
                        albumId: currentAlbum.id,
                        photoIds: ids,
                        hours,
                      }),
                    });
                    notifyPhotosChanged();
                    await reload({ silent: true });
                  }
                : undefined
            }
          />
        ) : (
          <PhotoGrid
            photos={visible}
            profiles={profileById}
            mode={mode}
            shareKey={shareKey}
            lastSeenAt={compareSeen}
            viewerId={viewerId}
            onToggleHighlight={toggleHighlight}
            selecting={mode === "teilnehmer" && selecting}
            selectedIds={selectedIds}
            duplicateIds={duplicateIds}
            onToggleSelect={(photo) => {
              setSelectedIds((prev) => {
                const next = new Set(prev);
                if (next.has(photo.id)) next.delete(photo.id);
                else next.add(photo.id);
                return next;
              });
            }}
          />
        )}
        {mode === "teilnehmer" && selecting && currentAlbum ? (
          <GalleryBulkBar
            albumId={currentAlbum.id}
            albums={albums}
            selected={selectedPhotos}
            onClear={() => setSelectedIds(new Set())}
            onSelectAll={() =>
              setSelectedIds(new Set(visible.map((photo) => photo.id)))
            }
            onDone={() => {
              setSelecting(false);
              setSelectedIds(new Set());
            }}
          />
        ) : null}
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
      {currentAlbum ? (
        <DownloadZipDialog
          open={zipOpen}
          busy={zipBusy}
          error={zipError}
          album={currentAlbum}
          photos={photos}
          profiles={profiles}
          onClose={() => {
            if (zipBusy) return;
            setZipOpen(false);
            setZipError(null);
          }}
          onConfirm={(input) => void downloadZip(input)}
        />
      ) : null}
      <FloatingDock mode={mode} shareKey={shareKey} />
    </div>
  );
}
