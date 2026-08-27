"use client";

import { useMemo, useState } from "react";
import { AppHeader } from "@/components/app-header";
import { FloatingDock } from "@/components/floating-dock";
import { PhotoFiltersSheet } from "@/components/photo-filters";
import { PhotoGrid } from "@/components/photo-grid";
import { PhotoMapDynamic } from "@/components/photo-map-dynamic";
import { PhotoTimeline } from "@/components/photo-timeline";
import { useTripData } from "@/hooks/use-trip-data";
import { emptyFilters, filterPhotos } from "@/lib/filters";
import type { PhotoFilters, ViewerMode } from "@/lib/types";

type TripViewProps = {
  mode: ViewerMode;
  shareKey: string | null;
  view: "grid" | "map" | "timeline";
};

export function TripView({ mode, shareKey, view }: TripViewProps) {
  const { photos, profiles, profileById, loading, error, shareLabel } =
    useTripData(mode, shareKey);
  const [filters, setFilters] = useState<PhotoFilters>(emptyFilters);
  const [openFilters, setOpenFilters] = useState(false);

  const visible = useMemo(
    () => filterPhotos(photos, filters),
    [photos, filters],
  );

  const title =
    mode === "guest" ? shareLabel || "Gäste-Galerie" : "Photobuddy";
  const subtitle =
    view === "map"
      ? "Karte"
      : view === "timeline"
        ? "Timeline"
        : `${visible.length} Foto${visible.length === 1 ? "" : "s"}`;

  return (
    <div className="min-h-dvh pb-28">
      <AppHeader
        title={title}
        subtitle={subtitle}
        filters={filters}
        onOpenFilters={() => setOpenFilters(true)}
      />
      <main className="mx-auto max-w-5xl px-4 py-4">
        {loading ? (
          <p className="py-16 text-center text-sm text-muted-foreground">
            Galerie wird geladen…
          </p>
        ) : error ? (
          <div className="rounded-2xl bg-card p-8 text-center shadow-card ring-1 ring-border">
            <p className="font-medium text-destructive">{error}</p>
          </div>
        ) : view === "map" ? (
          <PhotoMapDynamic
            photos={visible}
            profiles={profileById}
            mode={mode}
            shareKey={shareKey}
          />
        ) : view === "timeline" ? (
          <PhotoTimeline
            photos={visible}
            profiles={profileById}
            mode={mode}
            shareKey={shareKey}
          />
        ) : (
          <PhotoGrid
            photos={visible}
            profiles={profileById}
            mode={mode}
            shareKey={shareKey}
          />
        )}
      </main>
      <PhotoFiltersSheet
        open={openFilters}
        onClose={() => setOpenFilters(false)}
        filters={filters}
        onChange={setFilters}
        profiles={profiles}
      />
      <FloatingDock mode={mode} shareKey={shareKey} />
    </div>
  );
}
