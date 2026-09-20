import Link from "next/link";
import { MapStylesPreviewDynamic } from "@/components/map-styles-preview-dynamic";

export default function MapStylesPreviewPage() {
  return (
    <div className="min-h-dvh">
      <header className="glass-chrome sticky top-0 z-30 rounded-b-2xl">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3">
          <div className="min-w-0 flex-1">
            <p className="text-lg font-semibold leading-snug break-words">
              Kartenstile vergleichen
            </p>
            <p className="text-sm text-muted-foreground leading-snug break-words">
              Altdorf UR · 46.8806, 8.6444 · Zoom 16
            </p>
          </div>
          <Link
            href="/settings"
            className="inline-flex min-h-11 items-center rounded-2xl px-3 text-sm font-medium text-primary"
          >
            Zurück
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-4 pb-10">
        <p className="mb-4 text-sm text-muted-foreground leading-snug">
          Jede Karte zeigt denselben Ausschnitt. Zum Öffnen ohne Login:{" "}
          <a href="/map-compare.html" className="font-medium text-primary">
            /map-compare.html
          </a>
          .
        </p>
        <MapStylesPreviewDynamic />
      </main>
    </div>
  );
}
