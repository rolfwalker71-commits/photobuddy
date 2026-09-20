import { AppHeader } from "@/components/app-header";
import { FloatingDock } from "@/components/floating-dock";
import { WidgetsPanel } from "@/components/widgets-panel";

export default function WidgetsSettingsPage() {
  return (
    <div className="app-shell">
      <AppHeader
        title="Widgets"
        subtitle="Fotos auf dem Homescreen — via Scriptable"
      />
      <main className="mx-auto max-w-lg px-4 py-4">
        <WidgetsPanel />
      </main>
      <FloatingDock mode="teilnehmer" shareKey={null} />
    </div>
  );
}
