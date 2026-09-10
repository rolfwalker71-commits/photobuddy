"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { format, parseISO } from "date-fns";
import { de } from "date-fns/locale";
import { ArrowLeft, MapPin, Trash2 } from "lucide-react";
import { CommentSection } from "@/components/comment-section";
import { GuestNameDialog } from "@/components/guest-name-dialog";
import { PhotoLocationMapDynamic } from "@/components/photo-location-map-dynamic";
import {
  PhotoStage,
  type PhotoNeighbor,
} from "@/components/photo-stage";
import { ReactionBar } from "@/components/reaction-bar";
import { api, withKey } from "@/lib/api";
import { formatCoordPair, parseCoordPair } from "@/lib/coords";
import { hasGuestName, storeGuestName } from "@/lib/guest";
import { humanLocationName } from "@/lib/image";
import { appHref } from "@/lib/paths";
import { notifyPhotosChanged } from "@/lib/photos-sync";
import type { Photo, PhotoTag, Profile, UserRole, ViewerMode } from "@/lib/types";

const compactField =
  "h-9 w-full rounded-xl border border-border bg-background px-2.5 text-xs sm:text-sm";
const compactLabel = "text-xs font-medium text-muted-foreground";

type PhotoDetailProps = {
  photoId: string;
  mode: ViewerMode;
  shareKey: string | null;
};

export function PhotoDetail({ photoId, mode, shareKey }: PhotoDetailProps) {
  const router = useRouter();
  const [photo, setPhoto] = useState<Photo | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const [tags, setTags] = useState<PhotoTag[]>([]);
  const [description, setDescription] = useState("");
  const [title, setTitle] = useState("");
  const [tagInput, setTagInput] = useState("");
  const [locationName, setLocationName] = useState("");
  const [coordInput, setCoordInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [geocoding, setGeocoding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [askName, setAskName] = useState(false);
  const [neighbors, setNeighbors] = useState<{
    prev: PhotoNeighbor | null;
    next: PhotoNeighbor | null;
  }>({ prev: null, next: null });
  const photoRef = useRef<HTMLImageElement>(null);
  const [photoHeight, setPhotoHeight] = useState(0);
  const canEdit = mode === "teilnehmer";

  useEffect(() => {
    const load = async () => {
      try {
        if (mode === "teilnehmer") {
          const me = await api<{ user: { id: string; role: UserRole } }>("/api/auth/me");
          setUserId(me.user.id);
          setUserRole(me.user.role);
        }
        const data = await api<{
          photo: Photo;
          profile: Profile | null;
          tags: PhotoTag[];
          neighbors?: {
            prev: PhotoNeighbor | null;
            next: PhotoNeighbor | null;
          };
        }>(withKey(`/api/photos/${photoId}`, shareKey));
        setPhoto(data.photo);
        setTitle(data.photo.title ?? "");
        setDescription(data.photo.description ?? "");
        setLocationName(data.photo.location_name ?? "");
        setCoordInput(formatCoordPair(data.photo.latitude, data.photo.longitude));
        setProfile(data.profile);
        setTags(data.tags);
        setNeighbors(data.neighbors ?? { prev: null, next: null });
      } catch {
        setError(mode === "guest" && !shareKey ? "Gäste-Link fehlt." : "Foto nicht gefunden.");
      }
    };
    void load();
  }, [mode, photoId, shareKey]);

  const goToPhoto = useCallback(
    (id: string | undefined) => {
      if (!id) return;
      router.replace(appHref(mode, shareKey, "photo", id));
    },
    [mode, router, shareKey],
  );

  const goPrev = useCallback(() => {
    goToPhoto(neighbors.prev?.id);
  }, [goToPhoto, neighbors.prev?.id]);

  const goNext = useCallback(() => {
    goToPhoto(neighbors.next?.id);
  }, [goToPhoto, neighbors.next?.id]);

  useEffect(() => {
    if (neighbors.prev) {
      router.prefetch(appHref(mode, shareKey, "photo", neighbors.prev.id));
    }
    if (neighbors.next) {
      router.prefetch(appHref(mode, shareKey, "photo", neighbors.next.id));
    }
  }, [mode, neighbors.next, neighbors.prev, router, shareKey]);

  useEffect(() => {
    const img = photoRef.current;
    if (!img) return;
    const sync = () => setPhotoHeight(img.getBoundingClientRect().height);
    sync();
    img.addEventListener("load", sync);
    const ro = new ResizeObserver(sync);
    ro.observe(img);
    return () => {
      img.removeEventListener("load", sync);
      ro.disconnect();
    };
  }, [photo]);

  function requestGuestName() {
    if (hasGuestName()) return true;
    setAskName(true);
    return false;
  }

  function saveGuestName(name: string) {
    storeGuestName(name);
    setAskName(false);
  }

  function parsedCoords() {
    const trimmed = coordInput.trim();
    if (!trimmed) return { latitude: null, longitude: null };
    const pair = parseCoordPair(trimmed);
    if (!pair) return null;
    return pair;
  }

  async function saveMeta() {
    if (!canEdit || !photo) return;
    const coords = parsedCoords();
    if (coords === null) {
      setError("Koordinaten ungültig. Format: Breite, Länge (z. B. 47.05, 8.31).");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const data = await api<{ photo: Photo }>(`/api/photos/${photo.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          title: title.trim() || null,
          description: description.trim() || null,
          location_name: locationName.trim() || null,
          latitude: coords.latitude,
          longitude: coords.longitude,
        }),
      });
      setPhoto(data.photo);
      setCoordInput(formatCoordPair(data.photo.latitude, data.photo.longitude));
      notifyPhotosChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Speichern fehlgeschlagen.");
    } finally {
      setSaving(false);
    }
  }

  async function suggestPlace() {
    const coords = parsedCoords();
    if (!coords || coords.latitude == null || coords.longitude == null) {
      setError("Zuerst gültige Koordinaten eintragen.");
      return;
    }
    setGeocoding(true);
    setError(null);
    try {
      const data = await api<{ place_name: string | null }>(
        `/api/geocode/reverse?lat=${encodeURIComponent(String(coords.latitude))}&lng=${encodeURIComponent(String(coords.longitude))}`,
      );
      if (!data.place_name) {
        setError("Kein Ortsname gefunden.");
        return;
      }
      setLocationName(data.place_name);
    } catch {
      setError("Ortsvorschlag fehlgeschlagen.");
    } finally {
      setGeocoding(false);
    }
  }

  async function addTag() {
    if (!canEdit || !photo) return;
    const name = tagInput.trim();
    if (!name) return;
    try {
      const data = await api<{ tag: PhotoTag }>(`/api/photos/${photo.id}/tags`, {
        method: "POST",
        body: JSON.stringify({ name }),
      });
      setTags((prev) =>
        prev.some((t) => t.tag_id === data.tag.tag_id)
          ? prev
          : [...prev, data.tag],
      );
      setTagInput("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Tag fehlgeschlagen.");
    }
  }

  async function removePhoto() {
    if (!canEdit || !photo) return;
    if (!window.confirm("Dieses Foto wirklich löschen?")) return;
    await api(`/api/photos/${photo.id}`, { method: "DELETE" });
    notifyPhotosChanged();
    router.refresh();
    router.push(appHref(mode, shareKey, "gallery"));
  }

  if (error && !photo) {
    return <p className="px-4 py-10 text-center text-destructive">{error}</p>;
  }
  if (!photo) {
    return <p className="px-4 py-10 text-center text-muted-foreground">Laden…</p>;
  }

  const taken = photo.taken_at ?? photo.created_at;
  let when = taken;
  try {
    when = format(parseISO(taken), "d. MMMM yyyy, HH:mm", { locale: de });
  } catch {
    when = taken;
  }

  const mapLat = photo.latitude;
  const mapLng = photo.longitude;
  const showMap = mapLat != null && mapLng != null;
  const displayPlace = humanLocationName(photo.location_name);
  const locationLine =
    displayPlace ||
    (mapLat != null && mapLng != null
      ? formatCoordPair(mapLat, mapLng)
      : null);

  return (
    <article className="mx-auto max-w-3xl space-y-3 pb-8">
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => router.push(appHref(mode, shareKey, "gallery"))}
          className="inline-flex h-11 items-center gap-2 rounded-2xl bg-muted px-3 text-sm"
        >
          <ArrowLeft className="size-4" />
          Zurück
        </button>
        {canEdit ? (
          <button
            type="button"
            onClick={() => void removePhoto()}
            className="inline-flex size-11 items-center justify-center rounded-2xl bg-muted text-destructive"
            aria-label="Foto löschen"
          >
            <Trash2 className="size-5" />
          </button>
        ) : null}
      </div>

      <div className="space-y-2">
        <PhotoStage
          photo={photo}
          prev={neighbors.prev}
          next={neighbors.next}
          onPrev={goPrev}
          onNext={goNext}
          imageRef={photoRef}
        />
        {showMap ? (
          <div
            className="overflow-hidden rounded-2xl bg-card shadow-card ring-1 ring-border max-md:h-[var(--photo-h)] md:aspect-[5/2] md:max-h-48 md:h-auto"
            style={
              {
                "--photo-h": photoHeight > 0 ? `${photoHeight}px` : "16rem",
              } as CSSProperties
            }
            role="region"
            aria-label="Kartenausschnitt des Foto-Standorts"
          >
            <PhotoLocationMapDynamic
              key={`${mapLat}-${mapLng}`}
              latitude={mapLat}
              longitude={mapLng}
              locationName={photo.location_name}
              accentColor={profile?.accent_color}
            />
          </div>
        ) : null}
      </div>

      <div className="space-y-2.5 rounded-2xl bg-card p-3 shadow-card ring-1 ring-border">
        {canEdit ? (
          <div className="space-y-2">
            <label className="block space-y-1">
              <span className={compactLabel}>Titel</span>
              <input
                className={compactField}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </label>
            <label className="block space-y-1">
              <span className={compactLabel}>Beschreibung</span>
              <textarea
                rows={2}
                className={`${compactField} py-1.5`}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </label>
            <label className="block space-y-1">
              <span className={compactLabel}>Ort</span>
              <input
                className={compactField}
                value={locationName}
                onChange={(e) => setLocationName(e.target.value)}
                placeholder="Anzeigename in Timeline"
              />
            </label>
            <label className="block space-y-1">
              <span className={compactLabel}>Koordinaten</span>
              <input
                className={compactField}
                value={coordInput}
                onChange={(e) => setCoordInput(e.target.value)}
                placeholder="Breite, Länge — z. B. 47.05, 8.31"
                inputMode="decimal"
              />
            </label>
            <button
              type="button"
              disabled={geocoding || saving}
              onClick={() => void suggestPlace()}
              className="inline-flex h-9 items-center rounded-xl bg-muted px-3 text-xs font-medium"
            >
              {geocoding ? "Suche Ort…" : "Ort vorschlagen"}
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={() => void saveMeta()}
              className="inline-flex h-9 items-center rounded-xl bg-primary px-3 text-xs font-medium text-primary-foreground"
            >
              {saving ? "Speichern…" : "Änderungen speichern"}
            </button>
          </div>
        ) : photo.title || photo.description ? (
          <div>
            {photo.title ? (
              <h1 className="text-lg font-semibold leading-snug break-words">
                {photo.title}
              </h1>
            ) : null}
            {photo.description ? (
              <p className={`text-xs leading-relaxed break-words sm:text-sm ${photo.title ? "mt-1.5" : ""}`}>
                {photo.description}
              </p>
            ) : null}
          </div>
        ) : null}

        <p className="text-xs text-muted-foreground sm:text-sm">
          {profile?.display_name ?? "Teilnehmer"} · {when}
        </p>
        {locationLine ? (
          <p className="flex items-start gap-1 text-xs text-muted-foreground sm:text-sm">
            <MapPin className="mt-0.5 size-3.5 shrink-0 sm:size-4" />
            <span className="break-words">{locationLine}</span>
          </p>
        ) : null}

        <div className="flex flex-wrap gap-1.5">
          {tags.map((tag) => (
            <span
              key={tag.tag_id}
              className="rounded-full bg-muted px-2 py-0.5 text-xs"
            >
              #{tag.name}
            </span>
          ))}
        </div>

        {canEdit ? (
          <div className="flex gap-1.5">
            <input
              className={`${compactField} min-w-0 flex-1`}
              placeholder="Tag hinzufügen"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
            />
            <button
              type="button"
              onClick={() => void addTag()}
              className="inline-flex h-9 shrink-0 items-center rounded-xl bg-muted px-3 text-xs font-medium"
            >
              Tag
            </button>
          </div>
        ) : null}

        {error ? <p className="text-xs text-destructive">{error}</p> : null}
      </div>

      <ReactionBar
        photoId={photo.id}
        mode={mode}
        shareKey={shareKey}
        currentUserId={userId}
        onNeedGuestName={requestGuestName}
        compact
      />
      <CommentSection
        photoId={photo.id}
        mode={mode}
        shareKey={shareKey}
        currentUserId={userId}
        userRole={userRole}
        onNeedGuestName={requestGuestName}
        compact
      />
      <GuestNameDialog
        open={askName}
        required
        onSave={saveGuestName}
      />
    </article>
  );
}
