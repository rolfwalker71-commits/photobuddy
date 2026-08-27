"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { GuestNamePrompt } from "@/components/guest-name-prompt";
import { TripView } from "@/components/trip-view";

function GuestTripInner({ view }: { view: "grid" | "map" | "timeline" }) {
  const params = useSearchParams();
  const key = params.get("key");
  return (
    <>
      <GuestNamePrompt />
      <TripView mode="guest" shareKey={key} view={view} />
    </>
  );
}

export function GuestTripPage({
  view,
}: {
  view: "grid" | "map" | "timeline";
}) {
  return (
    <Suspense
      fallback={
        <p className="px-4 py-16 text-center text-sm text-muted-foreground">
          Gäste-Galerie wird geladen…
        </p>
      }
    >
      <GuestTripInner view={view} />
    </Suspense>
  );
}
