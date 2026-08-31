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
import { hasGuestName, storeGuestName } from "@/lib/guest";
import { appHref } from "@/lib/paths";
import { notifyPhotosChanged } from "@/lib/photos-sync";
import { humanLocationName } from "@/lib/image";
import type { Photo, PhotoTag, Profile, ViewerMode } from "@/lib/types";

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
  const [tags, setTags] = useState<PhotoTag[]>([]);
  const [description, setDescription] = useState("");
  const [title, setTitle] = useState("");
  const [tagInput, setTagInput] = useState("");
  const [locationName, setLocationName] = useState("");
  const [saving, setSaving] = useState(false);
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
          const me = await api<{ user: { id: string } }>("/api/auth/me");
          setUserId(me.user.id);
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

  async function saveMeta() {
    if (!canEdit || !photo) return;
    setSaving(true);
    setError(null);
    try {
      await api(`/api/photos/${photo.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          title: title.trim() || null,
          description: description.trim() || null,
          location_name: locationName.trim() || null,
        }),
      });
      setPhoto({ ...photo, title, description, location_name: locationName });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Speichern fehlgeschlagen.");
    } finally {
      setSaving(false);
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

  return (
    <article className="mx-auto max-w-3xl space-y-5 pb-8">
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

      <div className="space-y-3">
        <PhotoStage
          photo={photo}
          prev={neighbors.prev}
          next={neighbors.next}
          onPrev={goPrev}
          onNext={goNext}
          imageRef={photoRef}
        />
        {photo.latitude != null && photo.longitude != null ? (
          <div
            className="h-[var(--photo-h)] overflow-hidden rounded-2xl bg-card shadow-card ring-1 ring-border md:min-h-80"
            style={
              {
                "--photo-h": photoHeight > 0 ? `${photoHeight}px` : "16rem",
              } as CSSProperties
            }
            role="region"
            aria-label="Kartenausschnitt des Foto-Standorts"
          >
            <PhotoLocationMapDynamic
              latitude={photo.latitude}
              longitude={photo.longitude}
              locationName={photo.location_name}
              accentColor={profile?.accent_color}
            />
          </div>
        ) : null}
      </div>

      <div className="space-y-3 rounded-2xl bg-card p-4 shadow-card ring-1 ring-border">
        {canEdit ? (
          <div className="space-y-3">
            <label className="block space-y-1.5">
              <span className="text-sm font-medium">Titel</span>
              <input
                className="h-11 w-full rounded-2xl border border-border bg-background px-3 text-sm"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </label>
            <label className="block space-y-1.5">
              <span className="text-sm font-medium">Beschreibung</span>
              <textarea
                rows={3}
                className="w-full rounded-2xl border border-border bg-background px-3 py-2 text-sm"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </label>
            <label className="block space-y-1.5">
              <span className="text-sm font-medium">Ort</span>
              <input
                className="h-11 w-full rounded-2xl border border-border bg-background px-3 text-sm"
                value={locationName}
                onChange={(e) => setLocationName(e.target.value)}
              />
            </label>
            <button
              type="button"
              disabled={saving}
              onClick={() => void saveMeta()}
              className="inline-flex h-11 items-center rounded-2xl bg-primary px-4 text-sm font-medium text-primary-foreground"
            >
              {saving ? "Speichern…" : "Änderungen speichern"}
            </button>
          </div>
        ) : photo.title || photo.description ? (
          <div>
            {photo.title ? (
              <h1 className="text-xl font-semibold leading-snug break-words">
                {photo.title}
              </h1>
            ) : null}
            {photo.description ? (
              <p className={`text-sm leading-relaxed break-words ${photo.title ? "mt-2" : ""}`}>
                {photo.description}
              </p>
            ) : null}
          </div>
        ) : null}

        <p className="text-sm text-muted-foreground">
          {profile?.display_name ?? "Teilnehmer"} · {when}
        </p>
        {humanLocationName(photo.location_name) ? (
          <p className="flex items-start gap-1 text-sm text-muted-foreground">
            <MapPin className="mt-0.5 size-4 shrink-0" />
            <span className="break-words">
              {humanLocationName(photo.location_name)}
            </span>
          </p>
        ) : null}

        <div className="flex flex-wrap gap-2">
          {tags.map((tag) => (
            <span
              key={tag.tag_id}
              className="rounded-full bg-muted px-3 py-1 text-sm"
            >
              #{tag.name}
            </span>
          ))}
        </div>

        {canEdit ? (
          <div className="flex gap-2">
            <input
              className="h-11 min-w-0 flex-1 rounded-2xl border border-border bg-background px-3 text-sm"
              placeholder="Tag hinzufügen"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
            />
            <button
              type="button"
              onClick={() => void addTag()}
              className="inline-flex h-11 items-center rounded-2xl bg-muted px-4 text-sm font-medium"
            >
              Tag
            </button>
          </div>
        ) : null}

        {error ? <p className="text-sm text-destructive">{error}</p> : null}
      </div>

      <ReactionBar
        photoId={photo.id}
        mode={mode}
        shareKey={shareKey}
        currentUserId={userId}
        onNeedGuestName={requestGuestName}
      />
      <CommentSection
        photoId={photo.id}
        mode={mode}
        shareKey={shareKey}
        currentUserId={userId}
        onNeedGuestName={requestGuestName}
      />
      <GuestNameDialog
        open={askName}
        required
        onSave={saveGuestName}
      />
    </article>
  );
}
