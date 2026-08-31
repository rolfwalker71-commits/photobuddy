import { AdminNavLinks } from "@/components/admin-nav-links";
import { AppHeader } from "@/components/app-header";
import { FloatingDock } from "@/components/floating-dock";
import { SettingsPanel } from "@/components/settings-panel";

export default function SettingsPage() {
  return (
    <div className="min-h-dvh pb-28">
      <AppHeader
        title="Einstellungen"
        subtitle="Profil, Teilnehmer, Alben"
        trailing={<AdminNavLinks compact />}
      />
      <main className="mx-auto max-w-lg px-4 py-4">
        <SettingsPanel />
      </main>
      <FloatingDock mode="teilnehmer" shareKey={null} />
    </div>
  );
}
