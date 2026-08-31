"use client";

import { useEffect } from "react";
import { MapContainer, Marker, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { MapPin } from "lucide-react";
import { BasemapLayer } from "@/components/basemap-layer";
import { humanLocationName } from "@/lib/image";

type PhotoLocationMapProps = {
  latitude: number;
  longitude: number;
  locationName: string | null;
  accentColor?: string;
};

function Recenter({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap();
  useEffect(() => {
    map.setView([lat, lng], 15);
  }, [map, lat, lng]);
  return null;
}

function InvalidateOnResize() {
  const map = useMap();
  useEffect(() => {
    const container = map.getContainer();
    const ro = new ResizeObserver(() => {
      map.invalidateSize();
    });
    ro.observe(container);
    map.invalidateSize();
    return () => ro.disconnect();
  }, [map]);
  return null;
}

function markerIcon(color: string) {
  const svg = encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="36" viewBox="0 0 28 36"><path fill="${color}" stroke="white" stroke-width="2" d="M14 1c7 0 13 6 13 13 0 10-13 21-13 21S1 24 1 14C1 7 7 1 14 1z"/><circle cx="14" cy="14" r="5" fill="white"/></svg>`,
  );
  return L.icon({
    iconUrl: `data:image/svg+xml;charset=UTF-8,${svg}`,
    iconSize: [28, 36],
    iconAnchor: [14, 36],
  });
}

export default function PhotoLocationMap({
  latitude,
  longitude,
  locationName,
  accentColor = "#0f766e",
}: PhotoLocationMapProps) {
  const place = humanLocationName(locationName);
  const coords = `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;

  return (
    <div className="relative h-full w-full [&_.leaflet-bottom]:bottom-8">
      <MapContainer
        center={[latitude, longitude]}
        zoom={15}
        className="z-0 h-full w-full"
        scrollWheelZoom={false}
      >
        <Recenter lat={latitude} lng={longitude} />
        <InvalidateOnResize />
        <BasemapLayer />
        <Marker
          position={[latitude, longitude]}
          icon={markerIcon(accentColor)}
          interactive={false}
        />
      </MapContainer>
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute right-1.5 top-1.5">
          <span className="inline-flex size-6 items-center justify-center rounded-full bg-neutral-900/65 text-white backdrop-blur-sm">
            <MapPin className="size-3" aria-hidden />
            <span className="sr-only">Standort</span>
          </span>
        </div>
        <div className="absolute inset-x-0 bottom-0">
          <span className="block bg-white/70 px-2 py-1.5 text-center text-xs font-medium leading-snug text-neutral-900 backdrop-blur-sm">
            <span className="line-clamp-2 break-words">{place ?? coords}</span>
          </span>
        </div>
      </div>
    </div>
  );
}
