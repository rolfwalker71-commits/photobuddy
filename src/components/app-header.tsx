"use client";

import { Filter, SlidersHorizontal } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { InstallButton } from "@/components/pwa/install-button";
import { isFiltered } from "@/lib/filters";
import type { PhotoFilters } from "@/lib/types";

type AppHeaderProps = {
  title: string;
  subtitle?: string;
  onOpenFilters?: () => void;
  filters?: PhotoFilters;
  trailing?: React.ReactNode;
};

export function AppHeader({
  title,
  subtitle,
  onOpenFilters,
  filters,
  trailing,
}: AppHeaderProps) {
  const active = filters ? isFiltered(filters) : false;

  return (
    <header className="sticky top-0 z-30 border-b border-border/70 bg-background/90 backdrop-blur-md">
      <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-3">
        <div className="min-w-0 flex-1">
          <p className="text-lg font-semibold leading-snug break-words">
            {title}
          </p>
          {subtitle ? (
            <p className="text-sm text-muted-foreground leading-snug break-words">
              {subtitle}
            </p>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {onOpenFilters ? (
            <button
              type="button"
              onClick={onOpenFilters}
              className="relative inline-flex size-11 items-center justify-center rounded-2xl bg-muted text-foreground"
              aria-label="Filter öffnen"
            >
              {active ? (
                <Filter className="size-5" />
              ) : (
                <SlidersHorizontal className="size-5" />
              )}
              {active ? (
                <span className="absolute right-1.5 top-1.5 size-2 rounded-full bg-accent" />
              ) : null}
            </button>
          ) : null}
          {trailing}
          <ThemeToggle />
          <span className="hidden sm:inline-flex">
            <InstallButton compact />
          </span>
        </div>
      </div>
    </header>
  );
}
