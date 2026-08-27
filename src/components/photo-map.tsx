"use client";

import { useMemo } from "react";
import { MapContainer, Marker, Popup, TileLayer } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import Link from "next/link";
import { appHref } from "@/lib/paths";
import { publicPhotoUrl } from "@/lib/storage";
import type { Photo, Profile, ViewerMode } from "@/lib/types";

type PhotoMapProps = {
  photos: Photo[];
  profiles: Record<string, Profile>;
  mode: ViewerMode;
  shareKey: string | null;
};

function markerIcon(color: string) {
  const svg = encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="36" viewBox="0 0 28 36"><path fill="${color}" stroke="white" stroke-width="2" d="M14 1c7 0 13 6 13 13 0 10-13 21-13 21S1 24 1 14C1 7 7 1 14 1z"/><circle cx="14" cy="14" r="5" fill="white"/></svg>`,
  );
  return L.icon({
    iconUrl: `data:image/svg+xml;charset=UTF-8,${svg}`,
    iconSize: [28, 36],
    iconAnchor: [14, 36],
    popupAnchor: [0, -32],
  });
}

export default function PhotoMap({
  photos,
  profiles,
  mode,
  shareKey,
}: PhotoMapProps) {
  const located = photos.filter(
    (p) => p.latitude != null && p.longitude != null,
  );

  const center = useMemo<[number, number]>(() => {
    if (located[0]) return [located[0].latitude as number, located[0].longitude as number];
    return [48.2082, 16.3738];
  }, [located]);

  if (located.length === 0) {
    return (
      <div className="rounded-2xl bg-card p-8 text-center shadow-card ring-1 ring-border">
        <p className="font-medium">Keine GPS-Daten</p>
        <p className="mt-1 text-sm text-muted-foreground leading-snug">
          Fotos mit Standort erscheinen als Markierungen auf der Karte.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl shadow-card ring-1 ring-border">
      <MapContainer
        center={center}
        zoom={located.length === 1 ? 12 : 5}
        className="z-0 h-[min(70vh,36rem)] w-full"
        scrollWheelZoom
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {located.map((photo) => {
          const color = profiles[photo.uploaded_by]?.accent_color ?? "#0f766e";
          const src = publicPhotoUrl(photo.thumbnail_path ?? photo.storage_path);
          const author =
            profiles[photo.uploaded_by]?.display_name ?? "Unbekannt";
          return (
            <Marker
              key={photo.id}
              position={[photo.latitude as number, photo.longitude as number]}
              icon={markerIcon(color)}
            >
              <Popup>
                <Link
                  href={appHref(mode, shareKey, "photo", photo.id)}
                  className="block w-40"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={src}
                    alt={photo.title || `Foto von ${author}`}
                    className="mb-2 h-24 w-full rounded-lg object-cover"
                  />
                  <strong className="block text-sm leading-snug">
                    {photo.title || author}
                  </strong>
                  {photo.location_name ? (
                    <span className="text-xs">{photo.location_name}</span>
                  ) : null}
                </Link>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>
    </div>
  );
}
