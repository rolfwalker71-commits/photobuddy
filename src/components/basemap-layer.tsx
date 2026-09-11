"use client";

import { useEffect } from "react";
import { TileLayer, useMap } from "react-leaflet";
import { useMapStyle } from "@/hooks/use-map-style";
import type { MapStyle } from "@/lib/map-styles";

function ClampMaxZoom({ maxZoom }: { maxZoom: number }) {
  const map = useMap();
  useEffect(() => {
    map.setMaxZoom(maxZoom);
    if (map.getZoom() > maxZoom) map.setZoom(maxZoom);
  }, [map, maxZoom]);
  return null;
}

export function BasemapTiles({ style }: { style: MapStyle }) {
  return (
    <>
      <ClampMaxZoom maxZoom={style.maxZoom} />
      <TileLayer
        key={style.id}
        attribution={style.attribution}
        url={style.url}
        maxZoom={style.maxZoom}
        subdomains={style.subdomains}
      />
    </>
  );
}

export function BasemapLayer() {
  const style = useMapStyle();
  return <BasemapTiles style={style} />;
}
