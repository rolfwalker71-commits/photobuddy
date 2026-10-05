import type { ReactNode } from "react";

/**
 * Small, dependency-free inline-SVG illustrations for empty states and the
 * help page. Colours are the section palette (indigo, teal, orange, pink,
 * purple) and read on light and dark glass alike.
 */

const INDIGO = "#5B66F5";
const CORAL = "#FF6B66";
const TEAL = "#0DA89E";
const ORANGE = "#FA8C26";
const PINK = "#F24D8C";
const PURPLE = "#9E61EB";
const YELLOW = "#FFD166";

type ArtProps = { className?: string; title?: string };

function Art({
  children,
  className = "size-28",
  title,
  viewBox = "0 0 120 120",
}: ArtProps & { children: ReactNode; viewBox?: string }) {
  return (
    <svg
      viewBox={viewBox}
      className={className}
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      fill="none"
    >
      {children}
    </svg>
  );
}

/** Empty gallery: three tilted instant photos. */
export function PolaroidStack(props: ArtProps) {
  return (
    <Art {...props}>
      <g transform="rotate(-12 60 62)">
        <rect x="26" y="26" width="58" height="68" rx="6" fill="#fff" />
        <rect x="26" y="26" width="58" height="68" rx="6" stroke={TEAL} strokeOpacity=".35" />
        <rect x="32" y="32" width="46" height="44" rx="3" fill={TEAL} fillOpacity=".25" />
      </g>
      <g transform="rotate(9 60 62)">
        <rect x="36" y="22" width="58" height="68" rx="6" fill="#fff" />
        <rect x="36" y="22" width="58" height="68" rx="6" stroke={PINK} strokeOpacity=".35" />
        <rect x="42" y="28" width="46" height="44" rx="3" fill={PINK} fillOpacity=".25" />
      </g>
      <g>
        <rect x="31" y="30" width="58" height="68" rx="6" fill="#fff" />
        <rect x="31" y="30" width="58" height="68" rx="6" stroke={INDIGO} strokeOpacity=".45" />
        <rect x="37" y="36" width="46" height="44" rx="3" fill={INDIGO} />
        <circle cx="50" cy="48" r="5" fill={YELLOW} />
        <path d="M37 80 54 62l10 10 8-8 11 12v4H37z" fill={CORAL} />
        <rect x="41" y="86" width="26" height="4" rx="2" fill={INDIGO} fillOpacity=".25" />
      </g>
    </Art>
  );
}

/** Empty map: a dashed route linking three pins. */
export function RouteArt(props: ArtProps) {
  return (
    <Art {...props}>
      <rect x="10" y="22" width="100" height="76" rx="14" fill={TEAL} fillOpacity=".14" />
      <path
        d="M28 80c14-4 12-26 28-26s14 22 34 8"
        stroke={TEAL}
        strokeWidth="3.5"
        strokeLinecap="round"
        strokeDasharray="1 8"
      />
      <circle cx="28" cy="80" r="6" fill="#fff" stroke={TEAL} strokeWidth="3" />
      <circle cx="90" cy="62" r="6" fill="#fff" stroke={ORANGE} strokeWidth="3" />
      <path
        d="M56 28c-8 0-14 6-14 14 0 10 14 24 14 24s14-14 14-24c0-8-6-14-14-14z"
        fill={CORAL}
      />
      <circle cx="56" cy="42" r="5" fill="#fff" />
    </Art>
  );
}

/** Empty timeline: a calendar page with a few days marked. */
export function CalendarArt(props: ArtProps) {
  return (
    <Art {...props}>
      <rect x="20" y="26" width="80" height="72" rx="12" fill="#fff" />
      <rect x="20" y="26" width="80" height="72" rx="12" stroke={ORANGE} strokeOpacity=".4" />
      <path d="M20 40a12 12 0 0 1 12-14h56a12 12 0 0 1 12 14v6H20z" fill={ORANGE} />
      <rect x="36" y="18" width="6" height="16" rx="3" fill={INDIGO} />
      <rect x="78" y="18" width="6" height="16" rx="3" fill={INDIGO} />
      {[0, 1, 2].flatMap((row) =>
        [0, 1, 2, 3].map((col) => {
          const marked = (row === 0 && col === 1) || (row === 1 && col === 2) || (row === 2 && col === 0);
          return (
            <rect
              key={`${row}-${col}`}
              x={32 + col * 17}
              y={54 + row * 14}
              width="11"
              height="9"
              rx="3"
              fill={marked ? CORAL : ORANGE}
              fillOpacity={marked ? 1 : 0.22}
            />
          );
        }),
      )}
    </Art>
  );
}

/** Upload flow: Aufnehmen -> Verkleinern -> Hochladen -> Album. */
export function UploadFlow({ className = "w-full max-w-md" }: { className?: string }) {
  const steps = [
    { label: "Aufnehmen", color: PINK, glyph: <circle cx="0" cy="0" r="6" stroke="#fff" strokeWidth="2.5" /> },
    {
      label: "Verkleinern",
      color: ORANGE,
      glyph: <path d="M-6-2h5v-5M6 2h-5v5M-1-1l-6-6M1 1l6 6" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />,
    },
    {
      label: "Hochladen",
      color: TEAL,
      glyph: <path d="M0 7V-6M-5-1l5-5 5 5" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />,
    },
    { label: "Album", color: INDIGO, glyph: <rect x="-6" y="-6" width="12" height="12" rx="3" stroke="#fff" strokeWidth="2.5" /> },
  ];
  return (
    <Art className={className} viewBox="0 0 320 96" title="Aufnehmen, Verkleinern, Hochladen, Album">
      {steps.map((step, i) => {
        const x = 32 + i * 86;
        return (
          <g key={step.label}>
            <rect x={x - 28} y="8" width="56" height="56" rx="16" fill={step.color} />
            <g transform={`translate(${x} 36)`}>{step.glyph}</g>
            <text
              x={x}
              y="86"
              textAnchor="middle"
              fontSize="11"
              fontWeight="600"
              fill="currentColor"
              style={{ fontFamily: "inherit" }}
            >
              {step.label}
            </text>
            {i < steps.length - 1 ? (
              <path
                d={`M${x + 33} 36h14m-5-5 5 5-5 5`}
                stroke="currentColor"
                strokeOpacity=".45"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            ) : null}
          </g>
        );
      })}
    </Art>
  );
}

/** AI: a big four-pointed sparkle with two small ones. */
export function Sparkle(props: ArtProps) {
  return (
    <Art {...props}>
      <rect x="14" y="14" width="92" height="92" rx="26" fill={PURPLE} fillOpacity=".16" />
      <path d="M58 24c3 18 10 25 28 28-18 3-25 10-28 28-3-18-10-25-28-28 18-3 25-10 28-28z" fill={PURPLE} />
      <path d="M88 70c1.5 8 4 11 12 12-8 1.5-10.5 4-12 12-1.5-8-4-10.5-12-12 8-1 10.5-4 12-12z" fill={CORAL} />
      <path d="M32 74c1 6 3 8 9 9-6 1-8 3-9 9-1-6-3-8-9-9 6-1 8-3 9-9z" fill={YELLOW} />
    </Art>
  );
}
