import {
  Cloud,
  CloudFog,
  CloudLightning,
  CloudRain,
  CloudSnow,
  CloudSun,
  Sun,
} from "lucide-react";
import { weatherLabel, weatherTone } from "@/lib/weather";

const TONE_CLASS = {
  sun: "bg-amber-400 text-neutral-900",
  cloud: "bg-slate-400 text-neutral-900",
  rain: "bg-sky-500 text-white",
  snow: "bg-cyan-200 text-neutral-900",
  storm: "bg-violet-600 text-white",
} as const;

type WeatherChipProps = {
  code: number | null | undefined;
  tempC: number | null | undefined;
  compact?: boolean;
};

function WeatherIcon({
  code,
  compact,
}: {
  code: number;
  compact: boolean;
}) {
  const size = compact ? "size-2.5" : "size-3";
  if (code === 0) return <Sun className={size} aria-hidden />;
  if (code === 1 || code === 2) return <CloudSun className={size} aria-hidden />;
  if (code === 45 || code === 48) return <CloudFog className={size} aria-hidden />;
  if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) {
    return <CloudRain className={size} aria-hidden />;
  }
  if ((code >= 71 && code <= 77) || (code >= 85 && code <= 86)) {
    return <CloudSnow className={size} aria-hidden />;
  }
  if (code >= 95) return <CloudLightning className={size} aria-hidden />;
  return <Cloud className={size} aria-hidden />;
}

export function WeatherChip({ code, tempC, compact = false }: WeatherChipProps) {
  if (code == null && tempC == null) return null;
  const tone = weatherTone(code);
  const temp =
    tempC == null ? null : `${Math.round(tempC)}\u00a0°C`;
  const label = weatherLabel(code);
  return (
    <span
      className={`inline-flex w-max shrink-0 items-center gap-0.5 rounded-full font-semibold leading-none ${
        TONE_CLASS[tone]
      } ${compact ? "px-1 py-0.5 text-[0.5rem]" : "px-1.5 py-0.5 text-[0.625rem]"}`}
      title={label}
    >
      {code != null ? <WeatherIcon code={code} compact={compact} /> : null}
      {temp ? <span className="whitespace-nowrap tabular-nums">{temp}</span> : null}
      <span className="sr-only">{label}</span>
    </span>
  );
}
