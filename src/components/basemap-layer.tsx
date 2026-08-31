"use client";

import { useEffect } from "react";
import { TileLayer, useMap } from "react-leaflet";
import { useMapStyle } from "@/hooks/use-map-style";

function ClampMaxZoom({ maxZoom }: { maxZoom: number }) {
  const map = useMap();
  useEffect(() => {
    map.setMaxZoom(maxZoom);
    if (map.getZoom() > maxZoom) map.setZoom(maxZoom);
  }, [map, maxZoom]);
  return null;
}

export function BasemapLayer() {
  const style = useMapStyle();
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
