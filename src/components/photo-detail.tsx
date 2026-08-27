"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { format, parseISO } from "date-fns";
import { de } from "date-fns/locale";
import { ArrowLeft, MapPin, Trash2 } from "lucide-react";
import { CommentSection } from "@/components/comment-section";
import { GuestNameDialog } from "@/components/guest-name-dialog";
import { ReactionBar } from "@/components/reaction-bar";
import { getStoredGuestName, storeGuestName } from "@/lib/guest";
import { appHref } from "@/lib/paths";
import { publicPhotoUrl } from "@/lib/storage";
import { createClient } from "@/lib/supabase/client";
import type { Photo, PhotoTag, Profile, ViewerMode } from "@/lib/types";

type PhotoDetailProps = {
  photoId: string;
  mode: ViewerMode;
  shareKey: string | null;
};

export function PhotoDetail({ photoId, mode, shareKey }: PhotoDetailProps) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
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
  const [nameResolver, setNameResolver] = useState<((ok: boolean) => void) | null>(
    null,
  );

  useEffect(() => {
    const load = async () => {
      if (mode === "guest") {
        if (!shareKey) {
          setError("Gäste-Link fehlt.");
          return;
        }
        const { data, error: photoError } = await supabase.rpc("guest_get_photo", {
          p_key: shareKey,
          p_photo_id: photoId,
        });
        if (photoError) {
          setError("Foto nicht gefunden.");
          return;
        }
        const row = data as Photo;
        setPhoto(row);
        setTitle(row.title ?? "");
        setDescription(row.description ?? "");
        setLocationName(row.location_name ?? "");
        const { data: people } = await supabase.rpc("guest_list_profiles", {
          p_key: shareKey,
        });
        const match = (people ?? []).find((p: { id: string }) => p.id === row.uploaded_by);
        if (match) {
          setProfile({
            ...match,
            role: "teilnehmer",
            created_at: "",
            updated_at: "",
          } as Profile);
        }
        const { data: tagRows } = await supabase.rpc("guest_list_tags", {
          p_key: shareKey,
        });
        setTags(((tagRows ?? []) as PhotoTag[]).filter((t) => t.photo_id === photoId));
        return;
      }

      const { data: userData } = await supabase.auth.getUser();
      setUserId(userData.user?.id ?? null);
      const { data, error: photoError } = await supabase
        .from("photos")
        .select("*")
        .eq("id", photoId)
        .single();
      if (photoError || !data) {
        setError("Foto nicht gefunden.");
        return;
      }
      setPhoto(data as Photo);
      setTitle(data.title ?? "");
      setDescription(data.description ?? "");
      setLocationName(data.location_name ?? "");
      const { data: person } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", data.uploaded_by)
        .single();
      setProfile(person as Profile | null);
      const { data: tagRows } = await supabase
        .from("photo_tags")
        .select("photo_id, tag_id, tags(name)")
        .eq("photo_id", photoId);
      setTags(
        ((tagRows ?? []) as { photo_id: string; tag_id: string; tags: { name: string } | { name: string }[] | null }[]).map(
          (row) => ({
            photo_id: row.photo_id,
            tag_id: row.tag_id,
            name: Array.isArray(row.tags) ? row.tags[0]?.name : row.tags?.name ?? "",
          }),
        ),
      );
    };
    void load();
  }, [mode, photoId, shareKey, supabase]);

  function requestGuestName() {
    if (getStoredGuestName()) return true;
    setAskName(true);
    return false;
  }

  function saveGuestName(name: string) {
    storeGuestName(name);
    setAskName(false);
    nameResolver?.(true);
    setNameResolver(null);
  }

  async function saveMeta() {
    if (mode !== "teilnehmer" || !photo) return;
    setSaving(true);
    setError(null);
    const { error: updateError } = await supabase
      .from("photos")
      .update({
        title: title.trim() || null,
        description: description.trim() || null,
        location_name: locationName.trim() || null,
      })
      .eq("id", photo.id);
    setSaving(false);
    if (updateError) setError(updateError.message);
    else setPhoto({ ...photo, title, description, location_name: locationName });
  }

  async function addTag() {
    if (mode !== "teilnehmer" || !photo) return;
    const name = tagInput.trim();
    if (!name) return;
    const { data: existing } = await supabase
      .from("tags")
      .select("id, name")
      .ilike("name", name)
      .maybeSingle();
    let tagId = existing?.id as string | undefined;
    if (!tagId) {
      const { data: created, error: tagError } = await supabase
        .from("tags")
        .insert({ name })
        .select("id, name")
        .single();
      if (tagError) {
        setError(tagError.message);
        return;
      }
      tagId = created.id;
    }
    if (!tagId) return;
    const { error: linkError } = await supabase
      .from("photo_tags")
      .upsert({ photo_id: photo.id, tag_id: tagId });
    if (linkError) {
      setError(linkError.message);
      return;
    }
    setTags((prev) =>
      prev.some((t) => t.tag_id === tagId)
        ? prev
        : [...prev, { photo_id: photo.id, tag_id: tagId, name }],
    );
    setTagInput("");
  }

  async function removePhoto() {
    if (mode !== "teilnehmer" || !photo) return;
    if (!window.confirm("Dieses Foto wirklich löschen?")) return;
    await supabase.from("photos").delete().eq("id", photo.id);
    await supabase.storage.from("photos").remove(
      [photo.storage_path, photo.thumbnail_path].filter(Boolean) as string[],
    );
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
        {mode === "teilnehmer" ? (
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

      <div className="overflow-hidden rounded-2xl bg-card shadow-card ring-1 ring-border">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={publicPhotoUrl(photo.storage_path)}
          alt={photo.title || photo.description || "Reise-Foto"}
          className="max-h-[80vh] w-full object-contain"
        />
      </div>

      <div className="space-y-3 rounded-2xl bg-card p-4 shadow-card ring-1 ring-border">
        {mode === "teilnehmer" ? (
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
        ) : (
          <div>
            <h1 className="font-display text-xl font-semibold leading-snug break-words">
              {photo.title || "Ohne Titel"}
            </h1>
            {photo.description ? (
              <p className="mt-2 text-sm leading-relaxed break-words">
                {photo.description}
              </p>
            ) : null}
          </div>
        )}

        <p className="text-sm text-muted-foreground">
          {profile?.display_name ?? "Teilnehmer"} · {when}
        </p>
        {photo.location_name || (photo.latitude != null && photo.longitude != null) ? (
          <p className="flex items-start gap-1 text-sm text-muted-foreground">
            <MapPin className="mt-0.5 size-4 shrink-0" />
            <span className="break-words">
              {photo.location_name ||
                `${photo.latitude?.toFixed(4)}, ${photo.longitude?.toFixed(4)}`}
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

        {mode === "teilnehmer" ? (
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
        onClose={() => {
          setAskName(false);
          nameResolver?.(false);
          setNameResolver(null);
        }}
        onSave={saveGuestName}
      />
    </article>
  );
}
