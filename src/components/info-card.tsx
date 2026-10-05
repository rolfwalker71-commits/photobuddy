import type { CSSProperties, ReactNode } from "react";
import type { Section } from "@/lib/sections";
import { sectionColorVar } from "@/lib/sections";

type InfoCardProps = {
  illustration: ReactNode;
  title: string;
  children?: ReactNode;
  /** Tint of the card; defaults to the gallery's indigo. */
  section?: Section;
  /** Stack the illustration above the text (empty states). */
  centered?: boolean;
  action?: ReactNode;
  id?: string;
};

/** Illustration + title + text on a tinted glass card. */
export function InfoCard({
  illustration,
  title,
  children,
  section = "gallery",
  centered = false,
  action,
  id,
}: InfoCardProps) {
  return (
    <section
      id={id}
      className={`glass-panel glass-squircle scroll-mt-24 p-4 ${
        centered ? "flex flex-col items-center gap-3 text-center" : "flex items-start gap-4"
      }`}
      style={
        {
          backgroundImage: `linear-gradient(135deg, hsl(var(${sectionColorVar(section)}) / 0.14), hsl(var(${sectionColorVar(section)}) / 0.03))`,
        } as CSSProperties
      }
    >
      <div className="shrink-0">{illustration}</div>
      <div className="min-w-0 space-y-1.5">
        <h2 className="text-base font-semibold leading-snug">{title}</h2>
        {children ? (
          <div className="space-y-1.5 text-sm leading-snug text-muted-foreground">{children}</div>
        ) : null}
        {action ? <div className="pt-1">{action}</div> : null}
      </div>
    </section>
  );
}
