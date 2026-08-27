"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Camera, ImagePlus, LoaderCircle, MapPin } from "lucide-react";
import { api } from "@/lib/api";
import {
  isGeotaggingEnabled,
  prefetchDevicePosition,
  readDevicePosition,
  setGeotaggingEnabled,
  subscribeGeotagging,
} from "@/lib/geotag";
import {
  guessLocationName,
  prepareUploadFiles,
  readPhotoExif,
  toDatetimeLocalValue,
} from "@/lib/image";
import { notifyPhotosChanged } from "@/lib/photos-sync";

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
  fromCamera: boolean;
  geoSource: "exif" | "device" | "none";
};

function applyCoords(
  draft: Draft,
  lat: number,
  lng: number,
  source: "exif" | "device",
): Draft {
  return {
    ...draft,
    latitude: String(lat),
    longitude: String(lng),
    locationName: draft.locationName || guessLocationName(lat, lng) || "",
    geoSource: source,
  };
}

export function UploadForm() {
  const router = useRouter();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [geotag, setGeotag] = useState(true);
  const [locating, setLocating] = useState(false);

  useEffect(() => {
    setGeotag(isGeotaggingEnabled());
    return subscribeGeotagging(setGeotag);
  }, []);

  function toggleGeotag() {
    const next = !geotag;
    setGeotaggingEnabled(next);
    setGeotag(next);
    if (next) {
      prefetchDevicePosition();
      if (draft && (!draft.latitude || !draft.longitude)) {
        void fillMissingGps(draft).then(setDraft);
      }
      return;
    }
    if (draft) {
      setDraft({
        ...draft,
        latitude: "",
        longitude: "",
        locationName: "",
        geoSource: "none",
      });
    }
  }

  async function fillMissingGps(next: Draft) {
    if (!isGeotaggingEnabled()) return next;
    if (next.latitude && next.longitude) return next;
    setLocating(true);
    setStatus("Standort wird ermittelt…");
    try {
      const pos = await readDevicePosition();
      if (pos) {
        return applyCoords(next, pos.latitude, pos.longitude, "device");
      }
      return { ...next, geoSource: "none" as const };
    } finally {
      setLocating(false);
      setStatus(null);
    }
  }

  async function onPick(file: File | undefined, fromCamera: boolean) {
    if (!file) return;
    setError(null);
    const exif = await readPhotoExif(file);
    let next: Draft = {
      file,
      preview: URL.createObjectURL(file),
      takenAt: toDatetimeLocalValue(exif.takenAt),
      latitude: exif.latitude != null ? String(exif.latitude) : "",
      longitude: exif.longitude != null ? String(exif.longitude) : "",
      locationName: guessLocationName(exif.latitude, exif.longitude) ?? "",
      title: "",
      description: "",
      tags: "",
      fromCamera,
      geoSource: exif.latitude != null && exif.longitude != null ? "exif" : "none",
    };
    if (!isGeotaggingEnabled()) {
      next = {
        ...next,
        latitude: "",
        longitude: "",
        locationName: "",
        geoSource: "none",
      };
    } else {
      next = await fillMissingGps(next);
    }
    setDraft(next);
  }

  async function applyCurrentLocation() {
    if (!draft) return;
    setLocating(true);
    setError(null);
    const pos = await readDevicePosition(true);
    setLocating(false);
    if (!pos) {
      setError(
        "Standort nicht verfügbar. Im Browser den Standort erlauben — auf dem iPhone zusätzlich in Fotos den Ort freigeben.",
      );
      return;
    }
    setDraft(applyCoords(draft, pos.latitude, pos.longitude, "device"));
  }

  async function upload() {
    if (!draft) return;
    setBusy(true);
    setError(null);
    setStatus("Bild wird komprimiert…");
    try {
      await api("/api/auth/me");

      let ready = draft;
      if (isGeotaggingEnabled() && (!ready.latitude || !ready.longitude)) {
        ready = await fillMissingGps(ready);
        setDraft(ready);
      }

      const prepared = await prepareUploadFiles(ready.file);
      setStatus("Upload läuft…");

      const form = new FormData();
      form.append("file", prepared.full, "photo.jpg");
      form.append("thumb", prepared.thumb, "thumb.jpg");
      form.append("title", ready.title.trim());
      form.append("description", ready.description.trim());
      form.append("tags", ready.tags);
      form.append("takenAt", ready.takenAt ? new Date(ready.takenAt).toISOString() : "");
      form.append("latitude", isGeotaggingEnabled() ? ready.latitude : "");
      form.append("longitude", isGeotaggingEnabled() ? ready.longitude : "");
      form.append("locationName", ready.locationName.trim());
      form.append("width", String(prepared.width));
      form.append("height", String(prepared.height));

      const data = await api<{ photo: { id: string } }>("/api/photos", {
        method: "POST",
        body: form,
      });

      notifyPhotosChanged();
      router.refresh();
      router.push(`/photos/${data.photo.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload fehlgeschlagen.");
    } finally {
      setBusy(false);
      setStatus(null);
    }
  }

  const hasGps = Boolean(draft?.latitude && draft?.longitude);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3">
        <label
          className="flex min-h-24 cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl bg-card p-4 text-center shadow-card ring-1 ring-border"
          onClick={() => prefetchDevicePosition()}
        >
          <Camera className="size-6" />
          <span className="text-sm font-medium leading-snug">Foto aufnehmen</span>
          <input
            type="file"
            accept="image/*"
            capture="environment"
            className="sr-only"
            onChange={(e) => void onPick(e.target.files?.[0], true)}
          />
        </label>
        <label className="flex min-h-24 cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl bg-card p-4 text-center shadow-card ring-1 ring-border">
          <ImagePlus className="size-6" />
          <span className="text-sm font-medium leading-snug">Aus Galerie</span>
          <input
            type="file"
            accept="image/*"
            className="sr-only"
            onChange={(e) => void onPick(e.target.files?.[0], false)}
          />
        </label>
      </div>

      <button
        type="button"
        role="switch"
        aria-checked={geotag}
        onClick={toggleGeotag}
        className="flex min-h-11 w-full items-center justify-between gap-3 rounded-2xl bg-card px-4 py-3 text-left shadow-card ring-1 ring-border"
      >
        <span className="min-w-0">
          <span className="flex items-center gap-2 text-sm font-medium leading-snug">
            <MapPin className="size-4 shrink-0" aria-hidden />
            Standort anhängen
          </span>
          <span className="mt-0.5 block text-sm text-muted-foreground leading-snug">
            {geotag
              ? "EXIF-GPS oder aktueller Standort, wenn das Foto keinen Ort hat."
              : "Fotos werden ohne Koordinaten hochgeladen."}
          </span>
        </span>
        <span
          className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${
            geotag ? "bg-primary" : "bg-muted"
          }`}
        >
          <span
            className={`absolute top-0.5 size-6 rounded-full bg-card shadow transition-transform ${
              geotag ? "translate-x-5" : "translate-x-0.5"
            }`}
          />
        </span>
      </button>

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
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    latitude: e.target.value,
                    geoSource: e.target.value && draft.longitude ? draft.geoSource : "none",
                  })
                }
              />
            </label>
            <label className="block space-y-1.5">
              <span className="text-sm font-medium">Länge</span>
              <input
                inputMode="decimal"
                className="h-11 w-full rounded-2xl border border-border bg-background px-3 text-sm"
                value={draft.longitude}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    longitude: e.target.value,
                    geoSource: draft.latitude && e.target.value ? draft.geoSource : "none",
                  })
                }
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
          {geotag ? (
            <p className="text-sm leading-snug text-muted-foreground">
              {locating
                ? "Standort wird ermittelt…"
                : hasGps
                  ? draft.geoSource === "exif"
                    ? "GPS aus dem Foto (EXIF) übernommen."
                    : "Aktueller Standort vom Gerät übernommen."
                  : draft.fromCamera
                    ? "Die In-App-Kamera schreibt oft kein GPS. Aktuellen Standort erlauben oder manuell eintragen."
                    : "Kein GPS in der Datei. Auf dem iPhone: Fotos → Ort erlauben. Sonst aktuellen Standort nutzen."}
            </p>
          ) : null}
          {geotag && !hasGps ? (
            <button
              type="button"
              disabled={locating || busy}
              onClick={() => void applyCurrentLocation()}
              className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-2xl bg-muted text-sm font-medium disabled:opacity-60"
            >
              <MapPin className="size-4" aria-hidden />
              {locating ? "Suche Standort…" : "Aktuellen Standort setzen"}
            </button>
          ) : null}
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
          EXIF wird vor der Kompression gelesen. Kamera-Fotos ohne GPS bekommen
          den aktuellen Standort, wenn du ihn erlaubst. Das Bild wird vor dem
          Upload komprimiert — der Ort bleibt am Foto-Datensatz.
        </p>
      )}
    </div>
  );
}