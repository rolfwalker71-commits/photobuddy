"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Camera, ImagePlus, LoaderCircle } from "lucide-react";
import { guessLocationName, prepareUploadFiles, readPhotoExif } from "@/lib/image";
import { createClient } from "@/lib/supabase/client";

type Draft = {
  file: File;
  preview: string;
  takenAt: string;
  latitude: string;
  longitude: string;
  locationName: string;
  title: string;
  description: string;
  tags: string;
};

export function UploadForm() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onPick(file: File | undefined) {
    if (!file) return;
    setError(null);
    const exif = await readPhotoExif(file);
    setDraft({
      file,
      preview: URL.createObjectURL(file),
      takenAt: exif.takenAt ? exif.takenAt.slice(0, 16) : "",
      latitude: exif.latitude != null ? String(exif.latitude) : "",
      longitude: exif.longitude != null ? String(exif.longitude) : "",
      locationName: guessLocationName(exif.latitude, exif.longitude) ?? "",
      title: "",
      description: "",
      tags: "",
    });
  }

  async function upload() {
    if (!draft) return;
    setBusy(true);
    setError(null);
    setStatus("Bild wird komprimiert…");
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Bitte zuerst anmelden.");

      const prepared = await prepareUploadFiles(draft.file);
      const id = crypto.randomUUID();
      const storagePath = `${user.id}/${id}.jpg`;
      const thumbPath = `${user.id}/thumbs/${id}.jpg`;

      setStatus("Upload läuft…");
      const fullUpload = await supabase.storage
        .from("photos")
        .upload(storagePath, prepared.full, { contentType: "image/jpeg", upsert: false });
      if (fullUpload.error) throw fullUpload.error;
      const thumbUpload = await supabase.storage
        .from("photos")
        .upload(thumbPath, prepared.thumb, { contentType: "image/jpeg", upsert: false });
      if (thumbUpload.error) throw thumbUpload.error;

      const latitude = draft.latitude ? Number(draft.latitude) : null;
      const longitude = draft.longitude ? Number(draft.longitude) : null;
      const takenAt = draft.takenAt ? new Date(draft.takenAt).toISOString() : null;

      const { data: photo, error: insertError } = await supabase
        .from("photos")
        .insert({
          uploaded_by: user.id,
          storage_path: storagePath,
          thumbnail_path: thumbPath,
          title: draft.title.trim() || null,
          description: draft.description.trim() || null,
          taken_at: takenAt,
          latitude: Number.isFinite(latitude) ? latitude : null,
          longitude: Number.isFinite(longitude) ? longitude : null,
          location_name: draft.locationName.trim() || null,
          width: prepared.width,
          height: prepared.height,
          mime_type: "image/jpeg",
          file_size: prepared.full.size,
        })
        .select("id")
        .single();
      if (insertError) throw insertError;

      const names = draft.tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);
      for (const name of names) {
        const { data: existing } = await supabase
          .from("tags")
          .select("id")
          .ilike("name", name)
          .maybeSingle();
        let tagId = existing?.id as string | undefined;
        if (!tagId) {
          const { data: created } = await supabase
            .from("tags")
            .insert({ name })
            .select("id")
            .single();
          tagId = created?.id;
        }
        if (tagId && photo?.id) {
          await supabase.from("photo_tags").insert({ photo_id: photo.id, tag_id: tagId });
        }
      }

      router.push(`/photos/${photo.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload fehlgeschlagen.");
    } finally {
      setBusy(false);
      setStatus(null);
    }
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3">
        <label className="flex min-h-24 cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl bg-card p-4 text-center shadow-card ring-1 ring-border">
          <Camera className="size-6" />
          <span className="text-sm font-medium leading-snug">Foto aufnehmen</span>
          <input
            type="file"
            accept="image/*"
            capture="environment"
            className="sr-only"
            onChange={(e) => void onPick(e.target.files?.[0])}
          />
        </label>
        <label className="flex min-h-24 cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl bg-card p-4 text-center shadow-card ring-1 ring-border">
          <ImagePlus className="size-6" />
          <span className="text-sm font-medium leading-snug">Aus Galerie</span>
          <input
            type="file"
            accept="image/*"
            className="sr-only"
            onChange={(e) => void onPick(e.target.files?.[0])}
          />
        </label>
      </div>

      {draft ? (
        <div className="space-y-4 rounded-2xl bg-card p-4 shadow-card ring-1 ring-border">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={draft.preview}
            alt="Vorschau"
            className="max-h-80 w-full rounded-xl object-contain"
          />
          <label className="block space-y-1.5">
            <span className="text-sm font-medium">Titel</span>
            <input
              className="h-11 w-full rounded-2xl border border-border bg-background px-3 text-sm"
              value={draft.title}
              onChange={(e) => setDraft({ ...draft, title: e.target.value })}
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-sm font-medium">Beschreibung</span>
            <textarea
              rows={3}
              className="w-full rounded-2xl border border-border bg-background px-3 py-2 text-sm"
              value={draft.description}
              onChange={(e) => setDraft({ ...draft, description: e.target.value })}
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-sm font-medium">Tags (kommagetrennt)</span>
            <input
              className="h-11 w-full rounded-2xl border border-border bg-background px-3 text-sm"
              placeholder="Strand, Abendessen"
              value={draft.tags}
              onChange={(e) => setDraft({ ...draft, tags: e.target.value })}
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-sm font-medium">Aufgenommen</span>
            <input
              type="datetime-local"
              data-empty={draft.takenAt ? "false" : "true"}
              className="date-field h-11 w-full rounded-2xl border border-border bg-background px-3 text-sm"
              value={draft.takenAt}
              onChange={(e) => setDraft({ ...draft, takenAt: e.target.value })}
            />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block space-y-1.5">
              <span className="text-sm font-medium">Breite</span>
              <input
                inputMode="decimal"
                className="h-11 w-full rounded-2xl border border-border bg-background px-3 text-sm"
                value={draft.latitude}
                onChange={(e) => setDraft({ ...draft, latitude: e.target.value })}
              />
            </label>
            <label className="block space-y-1.5">
              <span className="text-sm font-medium">Länge</span>
              <input
                inputMode="decimal"
                className="h-11 w-full rounded-2xl border border-border bg-background px-3 text-sm"
                value={draft.longitude}
                onChange={(e) => setDraft({ ...draft, longitude: e.target.value })}
              />
            </label>
          </div>
          <label className="block space-y-1.5">
            <span className="text-sm font-medium">Ort</span>
            <input
              className="h-11 w-full rounded-2xl border border-border bg-background px-3 text-sm"
              value={draft.locationName}
              onChange={(e) => setDraft({ ...draft, locationName: e.target.value })}
            />
          </label>
          {status ? (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <LoaderCircle className="size-4 animate-spin" />
              {status}
            </p>
          ) : null}
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <button
            type="button"
            disabled={busy}
            onClick={() => void upload()}
            className="inline-flex h-11 w-full items-center justify-center rounded-2xl bg-primary text-sm font-medium text-primary-foreground disabled:opacity-60"
          >
            {busy ? "Bitte warten…" : "Hochladen"}
          </button>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground leading-snug">
          EXIF-Datum, Uhrzeit und GPS werden automatisch gelesen. Das Bild wird
          vor dem Upload komprimiert.
        </p>
      )}
    </div>
  );
}
