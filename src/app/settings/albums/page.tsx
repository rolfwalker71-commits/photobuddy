import Link from "next/link";
import { AdminAlbumsPanel } from "@/components/admin-albums-panel";
import { AdminNavLinks } from "@/components/admin-nav-links";
import { AppHeader } from "@/components/app-header";
import { FloatingDock } from "@/components/floating-dock";

export default function AdminAlbumsPage() {
  return (
    <div className="min-h-dvh pb-28">
      <AppHeader
        title="Alben"
        subtitle="Anlegen, Teilnehmer zuordnen, Gäste-Link teilen"
        trailing={<AdminNavLinks compact />}
      />
      <main className="mx-auto max-w-lg px-4 py-4">
        <p className="mb-4">
          <Link
            href="/settings"
            className="text-sm font-medium text-primary underline-offset-4 hover:underline"
          >
            Zurück zu Einstellungen
          </Link>
        </p>
        <AdminAlbumsPanel />
      </main>
      <FloatingDock mode="teilnehmer" shareKey={null} />
    </div>
  );
}
