export const DEFAULT_MAP_STYLE = "voyager" as const;

export const MAP_STYLE_IDS = [
  "voyager",
  "positron",
  "dark-matter",
  "osm",
  "topo",
  "satellite",
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
};

export const MAP_STYLE_LIST = MAP_STYLE_IDS.map((id) => MAP_STYLES[id]);

export function isMapStyleId(value: unknown): value is MapStyleId {
  return typeof value === "string" && value in MAP_STYLES;
}

export function parseMapStyleId(value: unknown): MapStyleId {
  return isMapStyleId(value) ? value : DEFAULT_MAP_STYLE;
}

export function getMapStyle(id: unknown): MapStyle {
  return MAP_STYLES[parseMapStyleId(id)];
}
