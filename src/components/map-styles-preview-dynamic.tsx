"use client";

import dynamic from "next/dynamic";

const MapStylesPreviewGrid = dynamic(
  () => import("@/components/map-styles-preview-grid"),
  {
    ssr: false,
    loading: () => (
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 15 }, (_, index) => (
          <div
            key={index}
            className="flex h-72 items-center justify-center rounded-2xl bg-card shadow-card ring-1 ring-border"
          >
            <p className="text-sm text-muted-foreground">Karte wird geladen…</p>
          </div>
        ))}
      </div>
    ),
  },
);

export function MapStylesPreviewDynamic() {
  return <MapStylesPreviewGrid />;
}
