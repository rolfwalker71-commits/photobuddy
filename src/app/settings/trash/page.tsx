import Link from "next/link";
import { AppHeader } from "@/components/app-header";
import { FloatingDock } from "@/components/floating-dock";
import { TrashPanel } from "@/components/trash-panel";

export default function TrashPage() {
  return (
    <div className="min-h-dvh pb-28">
      <AppHeader title="Papierkorb" subtitle="30 Tage wiederherstellbar" />
      <main className="mx-auto max-w-lg px-4 py-4">
        <p className="mb-4">
          <Link
            href="/settings"
            className="text-sm font-medium text-primary underline-offset-4 hover:underline"
          >
            Zurück zu Einstellungen
          </Link>
        </p>
        <TrashPanel />
      </main>
      <FloatingDock mode="teilnehmer" shareKey={null} />
    </div>
  );
}
