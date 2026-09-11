"use client";

import { useEffect } from "react";
import { CircleMarker, MapContainer, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { BasemapTiles } from "@/components/basemap-layer";
import { MAP_STYLE_LIST } from "@/lib/map-styles";

export const COMPARE_CENTER = { lat: 46.8806, lng: 8.6444 };
export const COMPARE_ZOOM = 16;

function InvalidateOnResize() {
  const map = useMap();
  useEffect(() => {
    const container = map.getContainer();
    const ro = new ResizeObserver(() => {
      map.invalidateSize();
    });
    ro.observe(container);
    const timer = window.setTimeout(() => map.invalidateSize(), 80);
    return () => {
      ro.disconnect();
      window.clearTimeout(timer);
    };
  }, [map]);
  return null;
}

export default function MapStylesPreviewGrid() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {MAP_STYLE_LIST.map((style) => {
        const zoom = Math.min(COMPARE_ZOOM, style.maxZoom);
        return (
          <figure
            key={style.id}
            className="overflow-hidden rounded-2xl bg-card shadow-card ring-1 ring-border"
          >
            <div className="h-56 w-full sm:h-64">
              <MapContainer
                center={[COMPARE_CENTER.lat, COMPARE_CENTER.lng]}
                zoom={zoom}
                maxZoom={style.maxZoom}
                scrollWheelZoom={false}
                className="z-0 h-full w-full"
              >
                <InvalidateOnResize />
                <BasemapTiles style={style} />
                <CircleMarker
                  center={[COMPARE_CENTER.lat, COMPARE_CENTER.lng]}
                  radius={6}
                  pathOptions={{
                    color: "#0f766e",
                    fillColor: "#0f766e",
                    fillOpacity: 0.85,
                    weight: 2,
                  }}
                  interactive={false}
                />
              </MapContainer>
            </div>
            <figcaption className="space-y-0.5 px-3 py-2.5">
              <p className="text-sm font-medium leading-snug break-words">
                {style.label}
              </p>
              <p className="text-sm text-muted-foreground leading-snug break-words">
                {style.description}
                {zoom < COMPARE_ZOOM
                  ? ` · Zoom ${zoom} (Maximum des Stils)`
                  : null}
              </p>
            </figcaption>
          </figure>
        );
      })}
    </div>
  );
}
