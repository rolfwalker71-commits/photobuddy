export const DEFAULT_MAP_STYLE = "voyager" as const;

export const MAP_STYLE_IDS = [
  "voyager",
  "positron",
  "dark-matter",
  "voyager-nolabels",
  "osm",
  "osm-de",
  "osm-hot",
  "cyclosm",
  "opnvkarte",
  "topo",
  "satellite",
  "esri-street",
  "esri-topo",
  "esri-gray",
  "esri-oceans",
] as const;

export type MapStyleId = (typeof MAP_STYLE_IDS)[number];

export type MapStyle = {
  id: MapStyleId;
  label: string;
  description: string;
  url: string;
  attribution: string;
  maxZoom: number;
  subdomains?: string;
  preview: [string, string, string];
};

const OSM_ATTR =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';
const CARTO_ATTR = `${OSM_ATTR} &copy; <a href="https://carto.com/attributions">CARTO</a>`;
const ESRI_PREFIX = "Kacheln &copy; Esri — ";

export const MAP_STYLES: Record<MapStyleId, MapStyle> = {
  voyager: {
    id: "voyager",
    label: "Voyager",
    description: "Bunt und übersichtlich",
    url: "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png",
    attribution: CARTO_ATTR,
    maxZoom: 20,
    subdomains: "abcd",
    preview: ["#9ec9a8", "#f3ead6", "#7eb6d9"],
  },
  positron: {
    id: "positron",
    label: "Positron",
    description: "Hell und schlicht",
    url: "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
    attribution: CARTO_ATTR,
    maxZoom: 20,
    subdomains: "abcd",
    preview: ["#e8e8e8", "#f7f7f7", "#c5d4de"],
  },
  "dark-matter": {
    id: "dark-matter",
    label: "Dark Matter",
    description: "Dunkel, passend zum Nachtmodus",
    url: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
    attribution: CARTO_ATTR,
    maxZoom: 20,
    subdomains: "abcd",
    preview: ["#1b1b1b", "#2a2a2a", "#3d4a55"],
  },
  "voyager-nolabels": {
    id: "voyager-nolabels",
    label: "Voyager ohne Text",
    description: "Bunt, ohne Ortsnamen",
    url: "https://{s}.basemaps.cartocdn.com/rastertiles/voyager_nolabels/{z}/{x}/{y}{r}.png",
    attribution: CARTO_ATTR,
    maxZoom: 20,
    subdomains: "abcd",
    preview: ["#a8d0b0", "#f4ecda", "#8ec0dc"],
  },
  osm: {
    id: "osm",
    label: "OpenStreetMap",
    description: "Klassisch, viele Beschriftungen",
    url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    attribution: OSM_ATTR,
    maxZoom: 19,
    subdomains: "abc",
    preview: ["#c8e6c0", "#f8f4e8", "#aad3df"],
  },
  "osm-de": {
    id: "osm-de",
    label: "OpenStreetMap DE",
    description: "Deutsche Kachelserver",
    url: "https://tile.openstreetmap.de/{z}/{x}/{y}.png",
    attribution: OSM_ATTR,
    maxZoom: 18,
    preview: ["#c4e2bc", "#f6f2e4", "#9ecfdb"],
  },
  "osm-hot": {
    id: "osm-hot",
    label: "Humanitär",
    description: "HOT-Stil, klar und kontrastreich",
    url: "https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png",
    attribution: `${OSM_ATTR}, Stil: <a href="https://www.hotosm.org/">Humanitarian OpenStreetMap Team</a>, bereitgestellt von <a href="https://www.openstreetmap.fr/">OpenStreetMap France</a>`,
    maxZoom: 19,
    subdomains: "abc",
    preview: ["#d4e8b8", "#f5edd8", "#b8d4e8"],
  },
  cyclosm: {
    id: "cyclosm",
    label: "CyclOSM",
    description: "Radwege und Radrouten",
    url: "https://{s}.tile-cyclosm.openstreetmap.fr/cyclosm/{z}/{x}/{y}.png",
    attribution: `<a href="https://www.cyclosm.org">CyclOSM</a> | ${OSM_ATTR}`,
    maxZoom: 20,
    subdomains: "abc",
    preview: ["#8fd19a", "#f2e6c8", "#6bb3d9"],
  },
  opnvkarte: {
    id: "opnvkarte",
    label: "ÖPNVKarte",
    description: "Bus, Bahn und ÖPNV",
    url: "https://tile.memomaps.de/tilegen/{z}/{x}/{y}.png",
    attribution: `Karte <a href="https://www.öpnvkarte.de/">ÖPNVKarte</a> / <a href="https://memomaps.de/">memomaps.de</a> (<a href="https://creativecommons.org/licenses/by-sa/2.0/">CC-BY-SA</a>), ${OSM_ATTR}`,
    maxZoom: 18,
    preview: ["#f0d48a", "#e8e0c8", "#c9a0d4"],
  },
  topo: {
    id: "topo",
    label: "OpenTopoMap",
    description: "Gelände und Wanderwege",
    url: "https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png",
    attribution: `Kartendaten: ${OSM_ATTR}, <a href="https://viewfinderpanoramas.org">SRTM</a> | Darstellung: &copy; <a href="https://opentopomap.org">OpenTopoMap</a> (<a href="https://creativecommons.org/licenses/by-sa/3.0/">CC-BY-SA</a>)`,
    maxZoom: 17,
    subdomains: "abc",
    preview: ["#b7d3a0", "#e6d3a8", "#8fb56a"],
  },
  satellite: {
    id: "satellite",
    label: "Satellit",
    description: "Luftbild (Esri)",
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    attribution:
      "Kacheln &copy; Esri — Quelle: Esri, Maxar, Earthstar Geographics und die GIS-User-Community",
    maxZoom: 19,
    preview: ["#1f3d2a", "#6b5a3a", "#2a4a6b"],
  },
  "esri-street": {
    id: "esri-street",
    label: "Esri Straßen",
    description: "Straßenkarte weltweit",
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}",
    attribution: `${ESRI_PREFIX}Quelle: Esri, DeLorme, NAVTEQ, USGS, Intermap, iPC, NRCAN, Esri Japan, METI, Esri China (Hong Kong), Esri (Thailand), TomTom`,
    maxZoom: 19,
    preview: ["#f2e6c4", "#d4e8b0", "#a8cce0"],
  },
  "esri-topo": {
    id: "esri-topo",
    label: "Esri Topo",
    description: "Topografische Karte",
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}",
    attribution: `${ESRI_PREFIX}Esri, DeLorme, NAVTEQ, TomTom, Intermap, iPC, USGS, FAO, NPS, NRCAN, GeoBase, Kadaster NL, Ordnance Survey, Esri Japan, METI, Esri China (Hong Kong) und die GIS-User-Community`,
    maxZoom: 19,
    preview: ["#c8dcb0", "#e8d8b0", "#9ec4a8"],
  },
  "esri-gray": {
    id: "esri-gray",
    label: "Esri Grau",
    description: "Hellgrau, zurückhaltend",
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}",
    attribution: `${ESRI_PREFIX}Esri, DeLorme, NAVTEQ`,
    maxZoom: 16,
    preview: ["#d8d8d8", "#eeeeee", "#c0c8cc"],
  },
  "esri-oceans": {
    id: "esri-oceans",
    label: "Esri Ozean",
    description: "Meere und Küsten",
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/Ocean/World_Ocean_Base/MapServer/tile/{z}/{y}/{x}",
    attribution: `${ESRI_PREFIX}Quellen: GEBCO, NOAA, CHS, OSU, UNH, CSUMB, National Geographic, DeLorme, NAVTEQ und Esri`,
    maxZoom: 13,
    preview: ["#c8e0d0", "#7eb8d0", "#2a6a8a"],
  },
};

export const MAP_STYLE_LIST = MAP_STYLE_IDS.map((id) => MAP_STYLES[id]);

export function isMapStyleId(value: unknown): value is MapStyleId {
  return typeof value === "string" && value in MAP_STYLES;
}

export function parseMapStyleId(value: unknown): MapStyleId {
  return isMapStyleId(value) ? value : DEFAULT_MAP_STYLE;
}

export function getMapStyle(id: unknown): MapStyle {
  const style = MAP_STYLES[parseMapStyleId(id)];
  if (style?.url) return style;
  return MAP_STYLES[DEFAULT_MAP_STYLE];
}

/** Leaflet overwrites its default `subdomains: "abc"` when the option is `undefined`. */
export function leafletTileProps(style: MapStyle): {
  url: string;
  attribution: string;
  maxZoom: number;
  subdomains?: string;
} {
  return {
    url: style.url,
    attribution: style.attribution,
    maxZoom: style.maxZoom,
    ...(style.subdomains ? { subdomains: style.subdomains } : {}),
  };
}
