"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Camera, ImagePlus, LoaderCircle, MapPin } from "lucide-react";
import { api } from "@/lib/api";
import {
  clearDevicePositionCache,
  isGeotaggingEnabled,
  prefetchDevicePosition,
  readDevicePosition,
  rememberAppliedPosition,
  setGeotaggingEnabled,
  subscribeGeotagging,
  type GeoCoords,
} from "@/lib/geotag";
import {
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

function revokeDrafts(items: Draft[]) {
  for (const item of items) {
    URL.revokeObjectURL(item.preview);
  }
}

function stripGps(draft: Draft): Draft {
  return {
    ...draft,
    latitude: "",
    longitude: "",
    locationName: "",
    geoSource: "none",
  };
}

function applyCoords(
  draft: Draft,
  lat: number,
  lng: number,
  source: "exif" | "device",
): Draft {
  rememberAppliedPosition({ latitude: lat, longitude: lng });
  return {
    ...draft,
    latitude: String(lat),
    longitude: String(lng),
    geoSource: source,
  };
}

async function draftFromFile(
  file: File,
  fromCamera: boolean,
  fallback: GeoCoords | null,
): Promise<Draft> {
  const exif = await readPhotoExif(file);
  const hasExif = exif.latitude != null && exif.longitude != null;
  const next: Draft = {
    file,
    preview: URL.createObjectURL(file),
    takenAt: toDatetimeLocalValue(exif.takenAt),
    latitude: hasExif ? String(exif.latitude) : "",
    longitude: hasExif ? String(exif.longitude) : "",
    locationName: "",
    title: "",
    description: "",
    tags: "",
    fromCamera,
    geoSource: hasExif ? "exif" : "none",
  };
  if (!isGeotaggingEnabled()) {
    return stripGps(next);
  }
  if (hasExif && exif.latitude != null && exif.longitude != null) {
    rememberAppliedPosition({
      latitude: exif.latitude,
      longitude: exif.longitude,
    });
    return next;
  }
  if (fallback) {
    return applyCoords(next, fallback.latitude, fallback.longitude, "device");
  }
  return next;
}

async function postPhoto(draft: Draft, shared: { title: string; description: string }) {
  const prepared = await prepareUploadFiles(draft.file);
  const form = new FormData();
  form.append("file", prepared.full, "photo.jpg");
  form.append("thumb", prepared.thumb, "thumb.jpg");
  form.append("title", shared.title);
  form.append("description", shared.description);
  form.append("tags", draft.tags);
  form.append("takenAt", draft.takenAt ? new Date(draft.takenAt).toISOString() : "");
  form.append("latitude", isGeotaggingEnabled() ? draft.latitude : "");
  form.append("longitude", isGeotaggingEnabled() ? draft.longitude : "");
  form.append("locationName", draft.locationName.trim());
  form.append("width", String(prepared.width));
  form.append("height", String(prepared.height));
  return api<{ photo: { id: string } }>("/api/photos", {
    method: "POST",
    body: form,
  });
}

export function UploadForm() {
  const router = useRouter();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [batch, setBatch] = useState<Draft[]>([]);
  const [sharedTitle, setSharedTitle] = useState("");
  const [sharedRemark, setSharedRemark] = useState("");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(
    null,
  );
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [geotag, setGeotag] = useState(true);
  const [locating, setLocating] = useState(false);

  useEffect(() => {
    setGeotag(isGeotaggingEnabled());
    return subscribeGeotagging(setGeotag);
  }, []);

  useEffect(() => {
    return () => {
      if (draft) revokeDrafts([draft]);
      revokeDrafts(batch);
    };
    // only on unmount
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      if (batch.length) {
        void (async () => {
          const pos = await readDevicePosition(true);
          setBatch((items) =>
            items.map((item) =>
              item.latitude && item.longitude
                ? item
                : pos
                  ? applyCoords(item, pos.latitude, pos.longitude, "device")
                  : item,
            ),
          );
        })();
      }
      return;
    }
    if (draft) setDraft(stripGps(draft));
    if (batch.length) setBatch((items) => items.map(stripGps));
  }

  async function fillMissingGps(next: Draft) {
    if (!isGeotaggingEnabled()) return next;
    if (next.latitude && next.longitude) return next;
    setLocating(true);
    setStatus("Standort wird ermittelt…");
    try {
      const pos = await readDevicePosition(true);
      if (pos) {
        return applyCoords(next, pos.latitude, pos.longitude, "device");
      }
      return { ...next, geoSource: "none" as const };
    } finally {
      setLocating(false);
      setStatus(null);
    }
  }

  async function onPickCamera(file: File | undefined) {
    if (!file) return;
    clearDevicePositionCache();
    setError(null);
    revokeDrafts(batch);
    setBatch([]);
    if (draft) revokeDrafts([draft]);
    let next = await draftFromFile(file, true, null);
    next = {
      ...next,
      title: sharedTitle,
      description: sharedRemark,
    };
    next = await fillMissingGps(next);
    setDraft(next);
  }

  async function onPickGallery(fileList: FileList | null) {
    const files = Array.from(fileList ?? []);
    if (!files.length) return;
    clearDevicePositionCache();
    setError(null);
    if (draft) revokeDrafts([draft]);
    setDraft(null);
    revokeDrafts(batch);
    setBatch([]);
    setStatus("Fotos werden vorbereitet…");
    setLocating(true);
    try {
      const fallback = isGeotaggingEnabled()
        ? await readDevicePosition(true)
        : null;
      const next: Draft[] = [];
      for (const file of files) {
        next.push(await draftFromFile(file, false, fallback));
      }
      setBatch(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Auswahl fehlgeschlagen.");
    } finally {
      setLocating(false);
      setStatus(null);
    }
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

  async function uploadSingle() {
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
      setStatus("Upload läuft…");
      const data = await postPhoto(ready, {
        title: ready.title.trim(),
        description: ready.description.trim(),
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

  async function uploadBatch() {
    if (!batch.length) return;
    setBusy(true);
    setError(null);
    const title = sharedTitle.trim();
    const description = sharedRemark.trim();
    let uploaded = 0;
    try {
      await api("/api/auth/me");
      for (let i = 0; i < batch.length; i += 1) {
        setProgress({ done: i, total: batch.length });
        setStatus(`Foto ${i + 1} von ${batch.length} wird komprimiert…`);
        await postPhoto(batch[i], { title, description });
        uploaded = i + 1;
      }
      setProgress({ done: batch.length, total: batch.length });
      notifyPhotosChanged();
      router.refresh();
      router.push("/gallery");
    } catch (err) {
      if (uploaded) notifyPhotosChanged();
      setError(
        err instanceof Error
          ? `${err.message}${uploaded ? ` (${uploaded} von ${batch.length} schon hochgeladen)` : ""}`
          : "Upload fehlgeschlagen.",
      );
    } finally {
      setBusy(false);
      setStatus(null);
      setProgress(null);
    }
  }

  const hasGps = Boolean(draft?.latitude && draft?.longitude);
  const shared = (
    <div className="space-y-3 rounded-2xl bg-card p-4 shadow-card ring-1 ring-border">
      <p className="text-sm font-medium leading-snug">Für alle Galerie-Fotos</p>
      <p className="text-sm text-muted-foreground leading-snug">
        Optional. Gilt für die ganze Auswahl. Später kannst du jedes Foto einzeln
        ändern. Leer lassen, wenn kein Text soll.
      </p>
      <label className="block space-y-1.5">
        <span className="text-sm font-medium">Titel für alle</span>
        <input
          className="h-11 w-full rounded-2xl border border-border bg-background px-3 text-sm"
          value={sharedTitle}
          onChange={(e) => setSharedTitle(e.target.value)}
          placeholder="z. B. Wanderung Rigi"
          disabled={busy}
        />
      </label>
      <label className="block space-y-1.5">
        <span className="text-sm font-medium">Bemerkung für alle</span>
        <textarea
          rows={3}
          className="w-full rounded-2xl border border-border bg-background px-3 py-2 text-sm"
          value={sharedRemark}
          onChange={(e) => setSharedRemark(e.target.value)}
          placeholder="Optional, z. B. Nachmittag am See"
          disabled={busy}
        />
      </label>
    </div>
  );

  return (
    <div className="space-y-5">
      {shared}

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
            disabled={busy}
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              void onPickCamera(file);
            }}
          />
        </label>
        <label className="flex min-h-24 cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl bg-card p-4 text-center shadow-card ring-1 ring-border">
          <ImagePlus className="size-6" />
          <span className="text-sm font-medium leading-snug">Aus Galerie</span>
          <span className="text-[0.7rem] text-muted-foreground leading-snug">
            Mehrere möglich
          </span>
          <input
            type="file"
            accept="image/*"
            multiple
            className="sr-only"
            disabled={busy}
            onChange={(e) => {
              const files = e.target.files;
              e.target.value = "";
              void onPickGallery(files);
            }}
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
              ? "Jedes Foto behält sein EXIF-GPS. Fehlt es, gilt der aktuelle Standort."
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

      {batch.length > 0 ? (
        <div className="space-y-4 rounded-2xl bg-card p-4 shadow-card ring-1 ring-border">
          <p className="text-sm font-medium leading-snug">
            {batch.length} Foto{batch.length === 1 ? "" : "s"} ausgewählt
          </p>
          <ul className="flex gap-2 overflow-x-auto pb-1">
            {batch.map((item, index) => (
              <li key={`${item.file.name}-${index}`} className="shrink-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={item.preview}
                  alt=""
                  className="size-20 rounded-xl object-cover ring-1 ring-border"
                />
              </li>
            ))}
          </ul>
          {geotag ? (
            <p className="text-sm leading-snug text-muted-foreground">
              {locating
                ? "Standort wird ermittelt…"
                : "GPS kommt aus dem jeweiligen Foto, sonst vom Gerät."}
            </p>
          ) : null}
          {status || progress ? (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <LoaderCircle className="size-4 animate-spin" />
              {progress
                ? `${progress.done}/${progress.total} — ${status ?? "Upload läuft…"}`
                : status}
            </p>
          ) : null}
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <button
            type="button"
            disabled={busy}
            onClick={() => void uploadBatch()}
            className="inline-flex h-11 w-full items-center justify-center rounded-2xl bg-primary text-sm font-medium text-primary-foreground disabled:opacity-60"
          >
            {busy
              ? progress
                ? `${progress.done}/${progress.total}…`
                : "Bitte warten…"
              : `${batch.length} Foto${batch.length === 1 ? "" : "s"} hochladen`}
          </button>
        </div>
      ) : null}

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
                  : "Die In-App-Kamera schreibt oft kein GPS. Aktuellen Standort erlauben oder manuell eintragen."}
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
            onClick={() => void uploadSingle()}
            className="inline-flex h-11 w-full items-center justify-center rounded-2xl bg-primary text-sm font-medium text-primary-foreground disabled:opacity-60"
          >
            {busy ? "Bitte warten…" : "Hochladen"}
          </button>
        </div>
      ) : null}

      {!draft && batch.length === 0 ? (
        <p className="text-sm text-muted-foreground leading-snug">
          Aus der Galerie kannst du mehrere Fotos auf einmal wählen. Jedes Bild
          behält sein eigenes EXIF-GPS. Titel und Bemerkung oben gelten für alle
          — leer lassen, wenn keins soll.
        </p>
      ) : null}
    </div>
  );
}
