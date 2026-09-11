import Link from "next/link";
import { AdminNavLinks } from "@/components/admin-nav-links";
import { AppHeader } from "@/components/app-header";
import { FloatingDock } from "@/components/floating-dock";
import { MapStylePicker } from "@/components/map-style-picker";

export default function MapStyleSettingsPage() {
  return (
    <div className="min-h-dvh pb-28">
      <AppHeader
        title="Darstellung"
        subtitle="Kartenstil für Galerie, Foto-Ausschnitt und Gäste-Links"
        trailing={<AdminNavLinks compact />}
      />
      <main className="mx-auto max-w-3xl px-4 py-4">
        <p className="mb-4">
          <Link
            href="/settings"
            className="text-sm font-medium text-primary underline-offset-4 hover:underline"
          >
            Zurück zu Einstellungen
          </Link>
        </p>
        <MapStylePicker />
      </main>
      <FloatingDock mode="teilnehmer" shareKey={null} />
    </div>
  );
}
