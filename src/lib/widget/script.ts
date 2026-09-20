/**
 * The Scriptable script a Teilnehmer copies onto their iPhone or iPad.
 *
 * Only the address and the personal token are baked in; everything else the
 * widget shows comes from /api/widget/data, so changing a setting in the app
 * takes effect on the next refresh without copying the script again.
 *
 * The body is inside String.raw and must therefore avoid backticks and `${`
 * entirely — hence string concatenation throughout.
 */
export function buildWidgetScript(base: string, token: string) {
  return SCRIPT.replace("__BASE__", JSON.stringify(base.replace(/\/$/, ""))).replace(
    "__TOKEN__",
    JSON.stringify(token),
  );
}

const SCRIPT = String.raw`// Variables used by Scriptable.
// These must be at the very top of the file. Do not edit.
// icon-color: teal; icon-glyph: camera-retro;

// Photobuddy — Widget
// Was das Widget zeigt, stellst du in der App ein: Einstellungen › Widgets.
// Änderungen dort gelten ab der nächsten Aktualisierung; das Skript musst du
// dafür nicht neu kopieren.
//
// Optionaler Widget-Parameter (Widget lange drücken › Widget bearbeiten):
//   klein:        lastPhoto · status
//   mittel:       lastPhoto · collage · status · route
//   gross:        lastPhoto · collage · route
//   extra gross:  collage · route

const BASE = __BASE__;
const TOKEN = __TOKEN__;

const fm = FileManager.local();
const dir = fm.joinPath(fm.cacheDirectory(), "photobuddy-widget");
if (!fm.fileExists(dir)) fm.createDirectory(dir, true);
const dataFile = fm.joinPath(dir, "data.json");

const MONTHS = ["Jan.", "Feb.", "März", "Apr.", "Mai", "Juni", "Juli", "Aug.", "Sept.", "Okt.", "Nov.", "Dez."];

let DATA = null;
let S = {};
let C = {};
let SIZE = [155, 155];

// ---------- data ----------

async function loadData() {
  try {
    const req = new Request(BASE + "/api/widget/data?token=" + encodeURIComponent(TOKEN));
    req.timeoutInterval = 15;
    const data = await req.loadJSON();
    const status = req.response ? req.response.statusCode : 200;
    if (status >= 400 || !data || !data.settings) {
      throw new Error(data && data.error ? data.error : "Server antwortet mit " + status);
    }
    fm.writeString(dataFile, JSON.stringify(data));
    return { data: data, offline: false };
  } catch (e) {
    // Out of signal on the road is the normal case, not the exception: show
    // the last answer rather than an error.
    if (fm.fileExists(dataFile)) {
      return { data: JSON.parse(fm.readString(dataFile)), offline: true };
    }
    return { data: null, offline: true, error: String(e.message || e) };
  }
}

async function image(path) {
  if (!path) return null;
  const url = /^https?:/i.test(path) ? path : BASE + path;
  const sep = url.indexOf("?") >= 0 ? "&" : "?";
  const full = url + sep + "token=" + encodeURIComponent(TOKEN);
  const file = fm.joinPath(dir, url.replace(/[^a-z0-9]/gi, "_").slice(-120) + ".img");
  if (fm.fileExists(file)) return fm.readImage(file);
  try {
    const img = await new Request(full).loadImage();
    fm.writeImage(file, img);
    return img;
  } catch (e) {
    return null;
  }
}

// ---------- dates ----------

function pad(n) { return (n < 10 ? "0" : "") + n; }

function parseStamp(value) {
  if (!value) return null;
  const d = new Date(value);
  return isNaN(d.getTime()) ? null : d;
}

function relative(value, now) {
  const d = parseStamp(value);
  if (!d) return "";
  const mins = Math.round((now - d) / 60000);
  if (mins < 2) return "gerade eben";
  if (mins < 60) return "vor " + mins + " Min.";
  const hours = Math.round(mins / 60);
  if (hours < 24) return "vor " + hours + " Std.";
  const days = Math.round(hours / 24);
  if (days === 1) return "gestern";
  if (days < 7) return "vor " + days + " Tagen";
  return d.getDate() + ". " + MONTHS[d.getMonth()];
}

function clock(value) {
  const d = parseStamp(value);
  return d ? d.getHours() + ":" + pad(d.getMinutes()) : "";
}

// ---------- weather ----------

// Open-Meteo WMO codes, collapsed to the handful a widget can show.
function weatherGlyph(code) {
  if (code == null) return "";
  if (code === 0) return "☀️";
  if (code <= 2) return "🌤";
  if (code === 3) return "☁️";
  if (code <= 48) return "🌫";
  if (code <= 67) return "🌧";
  if (code <= 77) return "🌨";
  if (code <= 82) return "🌦";
  if (code <= 86) return "🌨";
  return "⛈";
}

function weatherText(photo) {
  if (!S.showWeather) return "";
  const glyph = weatherGlyph(photo.weatherCode);
  const temp = photo.tempC == null ? "" : Math.round(photo.tempC) + "°";
  return (glyph + " " + temp).trim();
}

// ---------- look ----------

function dyn(light, dark, alpha) {
  const a = alpha === undefined ? 1 : alpha;
  if (S.theme === "light") return new Color(light, a);
  if (S.theme === "dark") return new Color(dark, a);
  return Color.dynamic(new Color(light, a), new Color(dark, a));
}

function setupColors() {
  C = {
    bg: dyn("#F7F3EC", "#101418"),
    card: dyn("#FFFFFF", "#1B2127"),
    ink: dyn("#19232A", "#F2EBDF"),
    muted: dyn("#5A6871", "#A9B2B8"),
    accent: dyn("#0F766E", "#3FB6A6"),
    warm: dyn("#C65B25", "#E88A4E"),
    hairline: dyn("#D8CFC2", "#2C343B"),
  };
}

// Rounded is the iOS widget voice; older Scriptable builds only have the
// plain system fonts, so fall back rather than crash.
function font(weight, size) {
  const rounded = weight + "RoundedSystemFont";
  if (typeof Font[rounded] === "function") return Font[rounded](size);
  return Font[weight + "SystemFont"](size);
}

function text(stack, value, f, color, opts) {
  const t = stack.addText(String(value));
  t.font = f;
  t.textColor = color;
  t.lineLimit = (opts && opts.lines) || 1;
  if (opts && opts.min) t.minimumScaleFactor = opts.min;
  if (opts && opts.center) t.centerAlignText();
  if (opts && opts.shadow) {
    // Captions sit straight on the photo in a few places; a soft shadow keeps
    // them readable over a bright sky.
    t.shadowColor = new Color("#000000", 0.55);
    t.shadowRadius = 4;
    t.shadowOffset = new Point(0, 1);
  }
  return t;
}

/** A translucent pane — the widget's version of the app's glass. */
function pane(stack, opts) {
  const box = stack.addStack();
  box.cornerRadius = (opts && opts.radius) || 12;
  box.setPadding.apply(box, (opts && opts.padding) || [7, 9, 7, 9]);
  box.backgroundColor =
    opts && opts.onPhoto ? new Color("#0B1014", 0.46) : dyn("#FFFFFF", "#222A31", 0.72);
  if (opts && opts.gradient) {
    const g = new LinearGradient();
    g.locations = [0, 1];
    g.colors = [new Color("#FFFFFF", 0.22), new Color("#FFFFFF", 0.06)];
    g.startPoint = new Point(0, 0);
    g.endPoint = new Point(0.4, 1);
    box.backgroundGradient = g;
  }
  return box;
}

function titleOf() {
  if (S.title) return S.title;
  return DATA.album ? DATA.album.name : "Photobuddy";
}

function header(w, right) {
  const row = w.addStack();
  row.centerAlignContent();
  text(row, titleOf(), font("bold", 13), C.ink, { min: 0.7 });
  row.addSpacer();
  if (right) text(row, right, font("medium", 11), C.muted, { min: 0.7 });
  return row;
}

function subtitleFor(photo, now) {
  const bits = [];
  if (S.showPlace && photo.place) bits.push(photo.place);
  bits.push(relative(photo.takenAt, now));
  if (S.showAuthor) bits.push(photo.author);
  return bits.filter(Boolean).join(" · ");
}

// Widget sizes in points, so DrawContext images land sharp. iPad values follow
// each model's portrait width.
function widgetSize(family) {
  const sw = Device.screenSize().width, sh = Device.screenSize().height;
  const w = Math.min(sw, sh), h = Math.max(sw, sh);
  let t;
  if (Device.isPad()) {
    if (w >= 1024) t = [170, 379, 379, 795];
    else if (w >= 820) t = [155, 342, 342, 715];
    else if (w >= 810) t = [146, 320, 320, 673];
    else t = [141, 305, 305, 634];
    return {
      small: [t[0], t[0]],
      medium: [t[1], t[0]],
      large: [t[2], t[2]],
      extraLarge: [t[3], t[2]],
    }[family];
  }
  if (w >= 428) t = [170, 364, 170, 382];
  else if (w >= 414) t = [169, 360, 169, 379];
  else if (w >= 390) t = [158, 338, 158, 354];
  else if (w >= 375 && h >= 812) t = [155, 329, 155, 345];
  else if (w >= 375) t = [148, 321, 148, 324];
  else t = [141, 292, 141, 311];
  return { small: [t[0], t[0]], medium: [t[1], t[2]], large: [t[1], t[3]] }[family];
}

function empty(w, line) {
  w.backgroundColor = C.bg;
  w.setPadding(14, 14, 14, 14);
  text(w, titleOf(), font("bold", 14), C.ink);
  w.addSpacer(6);
  text(w, line, font("medium", 11), C.muted, { lines: 4 });
}

// ---------- letztes Foto ----------

async function hero(w, family, now) {
  const photo = DATA.photos[0];
  if (!photo) {
    empty(w, S.onlyHighlights ? "Noch keine Highlights markiert." : "Noch keine Aufnahmen in diesem Album.");
    return;
  }

  const img = await image(photo.image);
  if (img) w.backgroundImage = img;
  else w.backgroundColor = C.card;

  // A dark foot under the caption, so white text holds over any photo.
  if (img) {
    const shade = new LinearGradient();
    shade.locations = [0, 0.45, 1];
    shade.colors = [
      new Color("#000000", 0),
      new Color("#000000", 0.1),
      new Color("#000000", 0.62),
    ];
    shade.startPoint = new Point(0.5, 0);
    shade.endPoint = new Point(0.5, 1);
    w.backgroundGradient = shade;
  }

  const padding = family === "small" ? 10 : 12;
  w.setPadding(padding, padding, padding, padding);

  const top = w.addStack();
  top.centerAlignContent();
  if (photo.isHighlight) {
    const star = pane(top, { onPhoto: true, radius: 9, padding: [3, 6, 3, 6], gradient: true });
    text(star, "★", font("bold", family === "small" ? 10 : 11), Color.white());
  }
  top.addSpacer();
  const weather = weatherText(photo);
  if (weather) {
    const chip = pane(top, { onPhoto: true, radius: 9, padding: [3, 7, 3, 7], gradient: true });
    text(chip, weather, font("semibold", family === "small" ? 10 : 11), Color.white());
  }

  w.addSpacer();

  const caption = pane(w, {
    onPhoto: true,
    radius: family === "small" ? 12 : 14,
    padding: family === "small" ? [7, 9, 8, 9] : [9, 11, 10, 11],
    gradient: true,
  });
  caption.layoutVertically();

  if (S.showPlace && photo.place) {
    text(caption, photo.place, font("bold", family === "small" ? 13 : 15), Color.white(), {
      min: 0.6,
      lines: family === "small" ? 1 : 2,
    });
  } else if (photo.title) {
    text(caption, photo.title, font("bold", family === "small" ? 13 : 15), Color.white(), { min: 0.6 });
  } else {
    text(caption, titleOf(), font("bold", family === "small" ? 13 : 15), Color.white(), { min: 0.6 });
  }

  const meta = [relative(photo.takenAt, now)];
  if (S.showAuthor) meta.push(photo.author);
  const line = caption.addStack();
  line.centerAlignContent();
  text(line, meta.join(" · "), font("medium", family === "small" ? 10 : 11), new Color("#FFFFFF", 0.86), { min: 0.7 });

  // The large tile has room for what came just before.
  if (family === "large" || family === "extraLarge") {
    w.addSpacer(8);
    const strip = w.addStack();
    strip.spacing = 6;
    const side = (SIZE[0] - 24 - 12) / 3;
    for (let i = 1; i <= 3; i++) {
      const p = DATA.photos[i];
      if (!p) break;
      const thumb = await image(p.thumb);
      const cell = strip.addStack();
      cell.size = new Size(side, side * 0.72);
      cell.cornerRadius = 10;
      if (thumb) cell.backgroundImage = thumb;
      else cell.backgroundColor = new Color("#FFFFFF", 0.2);
    }
  }
}

// ---------- Collage ----------

async function collage(w, family) {
  const photos = DATA.photos;
  if (photos.length === 0) {
    empty(w, S.onlyHighlights ? "Noch keine Highlights markiert." : "Noch keine Aufnahmen in diesem Album.");
    return;
  }

  w.backgroundColor = C.bg;
  w.setPadding(12, 12, 12, 12);

  const cols = family === "medium" ? 4 : family === "large" ? 3 : 6;
  const rows = family === "medium" ? 1 : family === "large" ? 3 : 2;
  const gap = 6;

  header(w, DATA.stats.today > 0 ? DATA.stats.today + " heute" : DATA.stats.total + " Fotos");
  w.addSpacer(8);

  const headerRoom = 26;
  const cellW = (SIZE[0] - 24 - gap * (cols - 1)) / cols;
  const cellH = (SIZE[1] - 24 - headerRoom - gap * (rows - 1)) / rows;

  let index = 0;
  for (let r = 0; r < rows; r++) {
    if (r > 0) w.addSpacer(gap);
    const row = w.addStack();
    row.spacing = gap;
    for (let c = 0; c < cols; c++) {
      const photo = photos[index++];
      const cell = row.addStack();
      cell.size = new Size(cellW, cellH);
      cell.cornerRadius = 12;
      if (!photo) {
        cell.backgroundColor = dyn("#EAE3D8", "#1B2127");
        continue;
      }
      const thumb = await image(photo.thumb);
      if (thumb) cell.backgroundImage = thumb;
      else cell.backgroundColor = dyn("#EAE3D8", "#1B2127");

      // Mark videos and highlights; at this size a glyph is all that fits.
      if (photo.isVideo || photo.isHighlight) {
        cell.layoutVertically();
        cell.addSpacer();
        const foot = cell.addStack();
        foot.addSpacer();
        const chip = pane(foot, { onPhoto: true, radius: 7, padding: [2, 5, 2, 5] });
        text(chip, photo.isVideo ? "▶" : "★", font("bold", 9), Color.white());
        foot.addSpacer(3);
        cell.addSpacer(3);
      }
    }
  }
}

// ---------- Reise-Status ----------

async function status(w, family, now) {
  w.backgroundColor = C.bg;
  w.setPadding(14, 14, 14, 14);

  const album = DATA.album;
  const stats = DATA.stats;
  const photo = DATA.photos[0];

  const top = w.addStack();
  top.centerAlignContent();
  text(top, titleOf(), font("bold", 12), C.muted, { min: 0.7 });
  top.addSpacer();
  if (family === "medium" && photo && S.showWeather) {
    const weather = weatherText(photo);
    if (weather) text(top, weather, font("semibold", 12), C.muted);
  }

  w.addSpacer(family === "small" ? 6 : 10);

  const body = family === "medium" ? w.addStack() : w;
  const left = family === "medium" ? body.addStack() : w;
  if (family === "medium") left.layoutVertically();

  if (album && album.day) {
    const dayRow = left.addStack();
    dayRow.bottomAlignContent();
    text(dayRow, "Tag " + album.day, font("heavy", family === "small" ? 26 : 30), C.ink, { min: 0.5 });
    if (album.days) {
      dayRow.addSpacer(4);
      text(dayRow, "von " + album.days, font("medium", 12), C.muted);
    }
  } else {
    text(left, stats.total + (stats.total === 1 ? " Foto" : " Fotos"), font("heavy", family === "small" ? 24 : 30), C.ink, { min: 0.5 });
  }

  left.addSpacer(4);

  const line = stats.today > 0
    ? stats.today + (stats.today === 1 ? " Aufnahme heute" : " Aufnahmen heute")
    : stats.week + " in dieser Woche";
  text(left, line, font("semibold", family === "small" ? 12 : 13), C.accent, { min: 0.7, lines: 2 });

  if (S.showPlace && stats.place) {
    left.addSpacer(2);
    text(left, stats.place, font("medium", family === "small" ? 11 : 12), C.muted, { min: 0.7, lines: 1 });
  }

  left.addSpacer();

  // Who has been contributing, in their own colour.
  const people = stats.contributors.slice(0, family === "small" ? 3 : 4);
  if (S.showAuthor && people.length > 0) {
    const row = left.addStack();
    row.centerAlignContent();
    row.spacing = 4;
    for (const person of people) {
      const dot = row.addStack();
      dot.size = new Size(8, 8);
      dot.cornerRadius = 4;
      dot.backgroundColor = new Color(person.color);
    }
    row.addSpacer(2);
    text(row, people.map(function (p) { return p.name.split(" ")[0]; }).join(", "), font("medium", 10), C.muted, { min: 0.6 });
  }

  if (family === "medium") {
    body.addSpacer(12);
    const thumb = photo ? await image(photo.thumb) : null;
    const cell = body.addStack();
    const side = Math.min(SIZE[1] - 28, 110);
    cell.size = new Size(side, side);
    cell.cornerRadius = 16;
    if (thumb) cell.backgroundImage = thumb;
    else cell.backgroundColor = C.card;
    if (photo) {
      cell.layoutVertically();
      cell.addSpacer();
      const foot = cell.addStack();
      foot.setPadding(0, 6, 6, 6);
      const chip = pane(foot, { onPhoto: true, radius: 8, padding: [2, 6, 3, 6], gradient: true });
      text(chip, relative(photo.takenAt, now), font("semibold", 9), Color.white(), { min: 0.6 });
    }
  }
}

// ---------- Route ----------

function mercator(lat) {
  const rad = (Math.max(-85, Math.min(85, lat)) * Math.PI) / 180;
  return Math.log(Math.tan(Math.PI / 4 + rad / 2));
}

function kmBetween(a, b) {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLon = ((b.lon - a.lon) * Math.PI) / 180;
  const la1 = (a.lat * Math.PI) / 180;
  const la2 = (b.lat * Math.PI) / 180;
  const h = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(la1) * Math.cos(la2) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

function routeLength(track) {
  let km = 0;
  for (let i = 1; i < track.length; i++) km += kmBetween(track[i - 1], track[i]);
  return km;
}

/** The track drawn straight onto a canvas — no map service, no API key. */
function routeImage(track, w, h, dark) {
  const ctx = new DrawContext();
  ctx.size = new Size(w, h);
  ctx.opaque = false;
  ctx.respectScreenScale = true;

  const pts = track.map(function (p) { return { x: (p.lon * Math.PI) / 180, y: mercator(p.lat) }; });
  let minX = pts[0].x, maxX = pts[0].x, minY = pts[0].y, maxY = pts[0].y;
  for (const p of pts) {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }
  const padding = 14;
  const spanX = Math.max(maxX - minX, 1e-6);
  const spanY = Math.max(maxY - minY, 1e-6);
  // One scale for both axes, or the route comes out stretched.
  const scale = Math.min((w - padding * 2) / spanX, (h - padding * 2) / spanY);
  const offX = (w - spanX * scale) / 2;
  const offY = (h - spanY * scale) / 2;
  const project = function (p) {
    return new Point(offX + (p.x - minX) * scale, h - offY - (p.y - minY) * scale);
  };

  const screen = pts.map(project);

  // A soft casing under the line, so it stays visible over the tinted card.
  const casing = new Path();
  casing.move(screen[0]);
  for (let i = 1; i < screen.length; i++) casing.addLine(screen[i]);
  ctx.setStrokeColor(new Color(dark ? "#000000" : "#FFFFFF", 0.55));
  ctx.setLineWidth(6);
  ctx.addPath(casing);
  ctx.strokePath();

  const line = new Path();
  line.move(screen[0]);
  for (let i = 1; i < screen.length; i++) line.addLine(screen[i]);
  ctx.setStrokeColor(new Color(dark ? "#3FB6A6" : "#0F766E"));
  ctx.setLineWidth(3);
  ctx.addPath(line);
  ctx.strokePath();

  // Start: a hollow ring. End: a filled pin with a white halo.
  const start = screen[0];
  ctx.setFillColor(new Color(dark ? "#101418" : "#FFFFFF"));
  ctx.fillEllipse(new Rect(start.x - 5, start.y - 5, 10, 10));
  ctx.setStrokeColor(new Color(dark ? "#3FB6A6" : "#0F766E"));
  ctx.setLineWidth(2.5);
  ctx.strokeEllipse(new Rect(start.x - 5, start.y - 5, 10, 10));

  const end = screen[screen.length - 1];
  ctx.setFillColor(new Color("#FFFFFF"));
  ctx.fillEllipse(new Rect(end.x - 7, end.y - 7, 14, 14));
  ctx.setFillColor(new Color(dark ? "#E88A4E" : "#C65B25"));
  ctx.fillEllipse(new Rect(end.x - 5, end.y - 5, 10, 10));

  return ctx.getImage();
}

async function route(w, family, now) {
  const track = DATA.track || [];
  if (track.length < 2) {
    empty(w, "Für die Route braucht es mindestens zwei Aufnahmen mit Standort.");
    return;
  }

  w.backgroundColor = C.bg;
  w.setPadding(12, 12, 12, 12);

  const km = routeLength(track);
  header(w, km >= 1 ? Math.round(km) + " km" : "");
  w.addSpacer(6);

  const dark = S.theme === "dark" || (S.theme !== "light" && Device.isUsingDarkAppearance());
  const canvasW = SIZE[0] - 24;
  const canvasH = SIZE[1] - 24 - 26 - (family === "medium" ? 0 : 34);

  const map = w.addStack();
  map.size = new Size(canvasW, canvasH);
  map.cornerRadius = 16;
  map.backgroundColor = dyn("#E7EEF0", "#17202A");
  map.setPadding(0, 0, 0, 0);
  const img = map.addImage(routeImage(track, canvasW, canvasH, dark));
  img.imageSize = new Size(canvasW, canvasH);

  // The large tile has room to name where the line ends.
  if (family !== "medium") {
    w.addSpacer(8);
    const foot = w.addStack();
    foot.centerAlignContent();
    const photo = DATA.photos[0];
    if (photo) {
      text(foot, S.showPlace && photo.place ? photo.place : titleOf(), font("semibold", 12), C.ink, { min: 0.6 });
      foot.addSpacer();
      text(foot, relative(photo.takenAt, now), font("medium", 11), C.muted, { min: 0.7 });
    } else {
      text(foot, track.length + " Stationen", font("medium", 12), C.muted);
    }
  }
}

// ---------- Sperrbildschirm ----------

async function lockScreen(w, family, now) {
  const photo = DATA.photos[0];
  const stats = DATA.stats;
  if (typeof w.addAccessoryWidgetBackground !== "undefined") {
    w.addAccessoryWidgetBackground = family !== "accessoryInline";
  }

  if (family === "accessoryInline") {
    const bits = [stats.today > 0 ? stats.today + " heute" : stats.total + " Fotos"];
    if (S.showPlace && photo && photo.place) bits.push(photo.place);
    text(w, "📷 " + bits.join(" · "), Font.systemFont(12), Color.white());
    return;
  }

  if (family === "accessoryCircular") {
    w.setPadding(2, 2, 2, 2);
    const box = w.addStack();
    box.layoutVertically();
    box.centerAlignContent();
    const n = box.addStack();
    n.addSpacer();
    text(n, String(stats.today > 0 ? stats.today : stats.total), font("bold", 20), Color.white(), { min: 0.5 });
    n.addSpacer();
    const label = box.addStack();
    label.addSpacer();
    text(label, stats.today > 0 ? "heute" : "Fotos", Font.systemFont(9), Color.white());
    label.addSpacer();
    return;
  }

  // accessoryRectangular
  w.setPadding(2, 4, 2, 4);
  const stack = w.addStack();
  stack.layoutVertically();
  text(stack, titleOf(), font("semibold", 12), Color.white(), { min: 0.7 });
  if (photo) {
    text(
      stack,
      S.showPlace && photo.place ? photo.place : relative(photo.takenAt, now),
      font("bold", 14),
      Color.white(),
      { min: 0.6 },
    );
    const meta = [];
    if (S.showPlace && photo.place) meta.push(relative(photo.takenAt, now));
    else if (photo.takenAt) meta.push(clock(photo.takenAt));
    if (stats.today > 0) meta.push(stats.today + " heute");
    text(stack, meta.join(" · "), Font.systemFont(11), new Color("#FFFFFF", 0.8), { min: 0.7 });
  } else {
    text(stack, "Noch keine Aufnahmen", Font.systemFont(11), new Color("#FFFFFF", 0.8), { lines: 2 });
  }
}

// ---------- build ----------

const LAYOUTS = {
  small: {
    lastPhoto: function (w, now) { return hero(w, "small", now); },
    status: function (w, now) { return status(w, "small", now); },
  },
  medium: {
    lastPhoto: function (w, now) { return hero(w, "medium", now); },
    collage: function (w) { return collage(w, "medium"); },
    status: function (w, now) { return status(w, "medium", now); },
    route: function (w, now) { return route(w, "medium", now); },
  },
  large: {
    lastPhoto: function (w, now) { return hero(w, "large", now); },
    collage: function (w) { return collage(w, "large"); },
    route: function (w, now) { return route(w, "large", now); },
  },
  extraLarge: {
    collage: function (w) { return collage(w, "extraLarge"); },
    route: function (w, now) { return route(w, "extraLarge", now); },
  },
};

async function build(family) {
  const w = new ListWidget();
  const loaded = await loadData();
  DATA = loaded.data;
  S = (DATA && DATA.settings) || {};
  setupColors();
  const now = new Date();
  // Half an hour is the interval iOS honours in practice for a widget that is
  // not time-critical; a new photo shows up at the next refresh either way.
  w.refreshAfterDate = new Date(now.getTime() + 30 * 60 * 1000);

  if (!DATA) {
    w.backgroundColor = C.bg;
    w.setPadding(14, 14, 14, 14);
    text(w, "Photobuddy", font("bold", 14), C.ink);
    w.addSpacer(6);
    text(
      w,
      "Keine Verbindung. Ist der Link noch gültig? Sonst in der App unter Einstellungen › Widgets das Skript neu kopieren.",
      font("medium", 11),
      C.muted,
      { lines: 5 },
    );
    return w;
  }

  w.url = BASE + (DATA.openUrl || "/gallery");

  if (family.indexOf("accessory") === 0) {
    await lockScreen(w, family, now);
    return w;
  }

  SIZE = widgetSize(family) || SIZE;
  const options = LAYOUTS[family] || LAYOUTS.small;
  const param = (args.widgetParameter || "").trim();
  const chosen = options[param] ? param : S[family];
  const render = options[chosen] || options[Object.keys(options)[0]];
  await render(w, now);
  return w;
}

let family = config.widgetFamily;
if (!family) {
  const a = new Alert();
  a.title = "Vorschau";
  a.addAction("Klein");
  a.addAction("Mittel");
  a.addAction("Gross");
  if (Device.isPad()) a.addAction("Extra gross");
  a.addCancelAction("Abbrechen");
  const pick = await a.presentSheet();
  family = ["small", "medium", "large", "extraLarge"][pick];
}

if (family) {
  const widget = await build(family);
  if (config.runsInWidget) {
    Script.setWidget(widget);
  } else if (family === "small") {
    await widget.presentSmall();
  } else if (family === "medium") {
    await widget.presentMedium();
  } else if (family === "large") {
    await widget.presentLarge();
  } else if (family === "extraLarge") {
    await widget.presentExtraLarge();
  }
}
Script.complete();
`;
