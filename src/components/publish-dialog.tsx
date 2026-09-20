"use client";

import { useEffect, useMemo, useState } from "react";
import { ExternalLink, Loader2, X } from "lucide-react";
import { api } from "@/lib/api";
import { dominantPlace, noteForDay, photoDayKey } from "@/lib/chapters";
import { formatAppDateTime } from "@/lib/format-date";
import { chapterAt, type SiteChapter } from "@/lib/site-chapters";
import type { DayNote, Photo, Profile } from "@/lib/types";

type Author = { key: string; name: string };
type Post = { route: string; title: string; date: string | null; published: boolean };
type Details = { site: string; authors: Author[]; posts: Post[]; chapters: SiteChapter[] };
type Target = "fotos" | "post" | "new-post";
type Result = {
  target: Target;
  route: string;
  created: boolean;
  published: boolean;
  url: string;
  panelUrl: string;
  uploaded: number;
  skipped: number;
};

type PublishDialogProps = {
  open: boolean;
  albumId: string;
  photos: Photo[];
  profileById: Record<string, Profile>;
  dayNotes: DayNote[];
  /** `published` is true once photos went to the website. */
  onClose: (published: boolean) => void;
};

/** Chapter select value meaning "each photo by its capture time". */
const BY_TIME = "";

function localInputValue(stamp: string) {
  const date = new Date(stamp);
  if (Number.isNaN(date.getTime())) return "";
  const two = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${two(date.getMonth() + 1)}-${two(date.getDate())}T${two(date.getHours())}:${two(date.getMinutes())}`;
}

function normalizeKey(value: string) {
  return value
    .trim()
    .split(/\s+/)[0]
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

function photoCount(n: number) {
  return n === 1 ? "1 Foto" : `${n} Fotos`;
}

export function PublishDialog({
  open,
  albumId,
  photos,
  profileById,
  dayNotes,
  onClose,
}: PublishDialogProps) {
  const [details, setDetails] = useState<Details | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [chapter, setChapter] = useState(BY_TIME);
  const [blog, setBlog] = useState(false);
  const [postMode, setPostMode] = useState<"new" | "existing">("new");
  const [route, setRoute] = useState("");
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [autor, setAutor] = useState("alle");
  const [ort, setOrt] = useState("");
  const [intro, setIntro] = useState("");
  const [text, setText] = useState("");
  const [published, setPublished] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);

  const images = useMemo(() => photos.filter((photo) => photo.kind === "photo"), [photos]);
  const videoCount = photos.length - images.length;
  const localTimes = useMemo(
    () => new Map(images.map((photo) => [photo.id, localInputValue(photo.taken_at ?? photo.created_at)])),
    [images],
  );
  const chapters = useMemo(() => details?.chapters ?? [], [details]);

  const byTimeLabel = useMemo(() => {
    // A new blog post belongs to the chapter of its date; loose photos each to their own.
    const times =
      blog && postMode === "new"
        ? [date]
        : images.map((photo) => localTimes.get(photo.id) ?? "");
    const found = new Set(times.map((local) => chapterAt(chapters, local)?.titel ?? ""));
    if (found.size === 1) {
      const only = [...found][0];
      return only ? `Nach Aufnahmezeit (${only})` : "Nach Aufnahmezeit";
    }
    return "Nach Aufnahmezeit (verschiedene Kapitel)";
  }, [images, chapters, localTimes, blog, postMode, date]);

  useEffect(() => {
    if (!open) return;
    setDetails(null);
    setLoadError(null);
    setResult(null);
    setError(null);
    setBusy(false);

    const sorted = [...images].sort((a, b) =>
      (a.taken_at ?? a.created_at).localeCompare(b.taken_at ?? b.created_at),
    );
    const place = dominantPlace(images) ?? "";
    const days = new Set(images.map(photoDayKey));
    const note = days.size === 1 ? noteForDay(dayNotes, [...days][0]) : null;
    setChapter(BY_TIME);
    setBlog(false);
    setPostMode("new");
    setRoute("");
    setTitle(place);
    setOrt(place);
    setDate(sorted[0] ? localInputValue(sorted[0].taken_at ?? sorted[0].created_at) : "");
    setIntro("");
    setText(note?.body ?? "");
    setPublished(false);

    let cancelled = false;
    // Photos with coordinates but no saved place name: look the name up for Ort and Titel.
    const located = place
      ? null
      : sorted.find((photo) => photo.latitude != null && photo.longitude != null);
    if (located) {
      api<{ place_name: string | null }>(
        `/api/geocode/reverse?lat=${located.latitude}&lng=${located.longitude}`,
      )
        .then((data) => {
          const name = data.place_name?.trim();
          if (!name || cancelled) return;
          setOrt((prev) => prev || name);
          setTitle((prev) => prev || name.split(",")[0].trim());
        })
        .catch(() => {});
    }
    api<Details>("/api/publish?details=1")
      .then((data) => {
        if (cancelled) return;
        setDetails({ ...data, chapters: data.chapters ?? [] });
        // Author: the one uploader of all selected photos, else everyone.
        const uploaders = new Set(images.map((photo) => photo.uploaded_by));
        const only = uploaders.size === 1 ? profileById[[...uploaders][0]] : null;
        const guess = only ? normalizeKey(only.display_name) : "";
        setAutor(data.authors.some((a) => a.key === guess) ? guess : "alle");
        setRoute(data.posts[0]?.route ?? "");
      })
      .catch((err) => {
        if (!cancelled) setLoadError(err instanceof Error ? err.message : "Webseite nicht erreichbar.");
      });
    return () => {
      cancelled = true;
    };
    // Reset only when the dialog opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const target: Target = !blog ? "fotos" : postMode === "existing" ? "post" : "new-post";
  const canSubmit =
    !busy &&
    details !== null &&
    images.length > 0 &&
    (target === "fotos" ||
      (target === "post" ? Boolean(route) : Boolean(title.trim() && date)));

  function close() {
    onClose(result !== null);
  }

  async function submit() {
    if (!canSubmit) return;
    setBusy(true);
    setError(null);
    const meta = Object.fromEntries(
      images.map((photo) => {
        const local = localTimes.get(photo.id) ?? "";
        const key = chapter === BY_TIME ? (chapterAt(chapters, local)?.schluessel ?? "") : chapter;
        return [photo.id, { datum: local.replace("T", " "), abschnitt: key }];
      }),
    );
    try {
      const data = await api<Result>("/api/publish", {
        method: "POST",
        body: JSON.stringify({
          albumId,
          photoIds: images.map((photo) => photo.id),
          meta,
          target,
          ...(target === "post" ? { route } : {}),
          ...(target === "new-post"
            ? {
                post: {
                  title,
                  date,
                  autor,
                  ort,
                  intro,
                  text,
                  published,
                  abschnitt:
                    chapter === BY_TIME ? (chapterAt(chapters, date)?.schluessel ?? "") : chapter,
                },
              }
            : {}),
        }),
      });
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Hochladen fehlgeschlagen.");
    } finally {
      setBusy(false);
    }
  }

  if (!open) return null;

  const field = "h-11 w-full rounded-2xl glass-fill outline-none transition-shadow focus-visible:ring-2 focus-visible:ring-primary/60 px-3 text-sm";
  const submitLabel =
    target === "fotos"
      ? "Auf die Fotos-Seite hochladen"
      : target === "post"
        ? "Zum Beitrag hinzufügen"
        : "Hochladen und Beitrag erstellen";

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <button
        type="button"
        className="glass-scrim animate-glass-fade absolute inset-0"
        aria-label="Schliessen"
        disabled={busy}
        onClick={close}
      />
      <form
        role="dialog"
        aria-modal="true"
        aria-labelledby="publish-title"
        aria-busy={busy}
        className="relative z-10 flex max-h-[min(46rem,92dvh)] w-full max-w-lg flex-col glass-sheet glass-sheen animate-glass-rise rounded-t-3xl p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:rounded-3xl sm:pb-5"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 id="publish-title" className="text-lg font-semibold leading-snug">
            Auf die Webseite
          </h2>
          <button
            type="button"
            onClick={close}
            disabled={busy}
            className="inline-flex size-11 items-center justify-center rounded-2xl bg-muted glass-interactive disabled:opacity-50"
            aria-label="Schliessen"
          >
            <X className="size-5" />
          </button>
        </div>

        {result ? (
          <div className="space-y-4">
            <p className="text-sm leading-snug">
              {photoCount(result.uploaded)} hochgeladen
              {result.skipped > 0 ? `, ${result.skipped} waren schon dort` : ""}.
              {result.target === "fotos"
                ? " Sie erscheinen auf der Seite „Fotos“."
                : result.published
                  ? " Der Beitrag ist auf der Webseite sichtbar."
                  : " Der Beitrag ist noch ein Entwurf – im Panel Text ergänzen und veröffentlichen."}
            </p>
            <a
              href={result.published ? result.url : result.panelUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-2xl glass-accent glass-interactive text-sm font-medium text-primary-foreground"
            >
              <ExternalLink className="size-4" />
              {result.target === "fotos"
                ? "Fotos-Seite ansehen"
                : result.published
                  ? "Beitrag ansehen"
                  : "Panel öffnen"}
            </a>
            <button
              type="button"
              onClick={close}
              className="inline-flex h-11 w-full items-center justify-center rounded-2xl bg-muted glass-interactive text-sm font-medium"
            >
              Fertig
            </button>
          </div>
        ) : loadError ? (
          <p className="text-sm text-destructive">{loadError}</p>
        ) : !details ? (
          <p className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Webseite wird geladen…
          </p>
        ) : (
          <>
            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto">
              <p className="text-sm text-muted-foreground leading-snug">
                {photoCount(images.length)} für {details.site.replace(/^https?:\/\//, "")}
                {videoCount > 0 ? ` · ${videoCount} Video(s) bleiben in Photobuddy` : ""}
              </p>

              {chapters.length > 0 ? (
                <label className="block space-y-1">
                  <span className="text-sm font-medium">Kapitel</span>
                  <select className={field} value={chapter} disabled={busy} onChange={(e) => setChapter(e.target.value)}>
                    <option value={BY_TIME}>{byTimeLabel}</option>
                    {chapters.map((item) => (
                      <option key={item.schluessel} value={item.schluessel}>
                        {item.nummer ? `${item.nummer}. ` : ""}
                        {item.titel}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}

              <div className="space-y-1">
                <span className="text-sm font-medium">Blogeintrag</span>
                <div className="grid grid-cols-2 gap-1 rounded-2xl bg-muted p-1" role="radiogroup" aria-label="Blogeintrag">
                  {(
                    [
                      [false, "Nein, nur Fotos"],
                      [true, "Ja"],
                    ] as const
                  ).map(([value, label]) => (
                    <button
                      key={label}
                      type="button"
                      role="radio"
                      aria-checked={blog === value}
                      disabled={busy}
                      onClick={() => setBlog(value)}
                      className={`h-10 rounded-xl text-sm font-medium ${blog === value ? "bg-card shadow-card" : ""}`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {blog ? (
                <>
                  <div className="grid grid-cols-2 gap-1 rounded-2xl bg-muted p-1" role="radiogroup" aria-label="Beitrag">
                    {(
                      [
                        ["new", "Neuer Beitrag"],
                        ["existing", "Bestehender"],
                      ] as const
                    ).map(([value, label]) => (
                      <button
                        key={value}
                        type="button"
                        role="radio"
                        aria-checked={postMode === value}
                        disabled={busy || (value === "existing" && details.posts.length === 0)}
                        onClick={() => setPostMode(value)}
                        className={`h-10 rounded-xl text-sm font-medium disabled:opacity-50 ${postMode === value ? "bg-card shadow-card" : ""}`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>

                  {postMode === "existing" ? (
                    <label className="block space-y-1">
                      <span className="text-sm font-medium">Beitrag</span>
                      <select className={field} value={route} disabled={busy} onChange={(e) => setRoute(e.target.value)}>
                        {details.posts.map((post) => (
                          <option key={post.route} value={post.route}>
                            {post.title}
                            {post.date ? ` · ${formatAppDateTime(post.date)}` : ""}
                            {post.published ? "" : " (Entwurf)"}
                          </option>
                        ))}
                      </select>
                    </label>
                  ) : (
                    <>
                      <label className="block space-y-1">
                        <span className="text-sm font-medium">Titel</span>
                        <input className={field} value={title} disabled={busy} onChange={(e) => setTitle(e.target.value)} required />
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        <label className="block space-y-1">
                          <span className="text-sm font-medium">Datum und Zeit</span>
                          <input type="datetime-local" className={field} value={date} disabled={busy} onChange={(e) => setDate(e.target.value)} required />
                        </label>
                        <label className="block space-y-1">
                          <span className="text-sm font-medium">Ort</span>
                          <input className={field} value={ort} disabled={busy} onChange={(e) => setOrt(e.target.value)} />
                        </label>
                      </div>
                      <label className="block space-y-1">
                        <span className="text-sm font-medium">Geschrieben von</span>
                        <select className={field} value={autor} disabled={busy} onChange={(e) => setAutor(e.target.value)}>
                          {details.authors.map((author) => (
                            <option key={author.key} value={author.key}>
                              {author.name}
                            </option>
                          ))}
                          <option value="alle">Alle</option>
                        </select>
                      </label>
                      <label className="block space-y-1">
                        <span className="text-sm font-medium">Kurztext</span>
                        <textarea className={`${field} h-auto py-2`} rows={2} value={intro} disabled={busy} onChange={(e) => setIntro(e.target.value)} />
                      </label>
                      <label className="block space-y-1">
                        <span className="text-sm font-medium">Text</span>
                        <textarea className={`${field} h-auto py-2`} rows={5} value={text} disabled={busy} onChange={(e) => setText(e.target.value)} />
                      </label>
                      <label className="flex min-h-11 items-center gap-3 rounded-2xl bg-muted px-3">
                        <input
                          type="checkbox"
                          className="size-5 accent-primary"
                          checked={published}
                          disabled={busy}
                          onChange={(e) => setPublished(e.target.checked)}
                        />
                        <span className="text-sm font-medium">Beitrag sofort sichtbar (sonst Entwurf)</span>
                      </label>
                    </>
                  )}
                </>
              ) : (
                <p className="text-sm text-muted-foreground leading-snug">
                  Die Fotos erscheinen auf der Seite „Fotos“ im gewählten Kapitel.
                </p>
              )}
            </div>

            {error ? <p className="mt-3 text-sm text-destructive">{error}</p> : null}
            <button
              type="submit"
              disabled={!canSubmit}
              className="mt-4 inline-flex h-11 w-full items-center justify-center gap-2 rounded-2xl glass-accent glass-interactive text-sm font-medium text-primary-foreground disabled:opacity-50"
            >
              {busy ? <Loader2 className="size-4 animate-spin" /> : null}
              {busy ? "Wird hochgeladen…" : submitLabel}
            </button>
          </>
        )}
      </form>
    </div>
  );
}
