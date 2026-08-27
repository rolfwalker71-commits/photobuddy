"use client";

import { useEffect, useState } from "react";
import { GuestNameDialog } from "@/components/guest-name-dialog";
import { getStoredGuestName, storeGuestName } from "@/lib/guest";

export function GuestNamePrompt() {
  const [ready, setReady] = useState(false);
  const [hasName, setHasName] = useState(true);

  useEffect(() => {
    setHasName(getStoredGuestName().length >= 2);
    setReady(true);
  }, []);

  if (!ready || hasName) return null;

  return (
    <GuestNameDialog
      open
      required
      onSave={(name) => {
        storeGuestName(name);
        setHasName(true);
      }}
    />
  );
}
