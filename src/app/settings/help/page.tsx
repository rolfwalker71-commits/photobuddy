import Link from "next/link";
import { AppHeader } from "@/components/app-header";
import { FloatingDock } from "@/components/floating-dock";
import { CalendarArt, PolaroidStack, RouteArt, Sparkle, UploadFlow } from "@/components/illustrations";
import { InfoCard } from "@/components/info-card";

export const metadata = { title: "Hilfe — Photobuddy" };

export default function HelpPage() {
  return (
    <div className="app-shell">
      <AppHeader title="Hilfe" subtitle="Photobuddy kurz erklärt" />
      <main className="mx-auto max-w-lg space-y-4 px-4 py-4">
        <p>
          <Link
            href="/settings"
            className="text-sm font-medium text-primary underline-offset-4 hover:underline"
          >
            Zurück zu Einstellungen
          </Link>
        </p>

        <InfoCard
          id="upload"
          section="camera"
          illustration={<UploadFlow className="w-full" />}
          centered
          title="So kommt ein Foto ins Album"
        >
          <p>
            Unter «Kamera» aufnehmen oder aus der Galerie wählen. Photobuddy verkleinert das
            Bild auf dem Gerät und legt es in eine Warteschlange. Ohne Netz bleibt es dort
            und wird automatisch hochgeladen, sobald wieder Empfang da ist.
          </p>
          <p>
            Fotos dürfen bis 15 MB gross sein, Videos dauern höchstens etwa 15 Sekunden.
            Doppelte Bilder erkennt Photobuddy und fragt nach.
          </p>
        </InfoCard>

        <InfoCard
          id="karte"
          section="map"
          illustration={<RouteArt className="size-20" />}
          title="Karte und Routen"
        >
          <p>
            Jedes Foto mit Standort erscheint als Vorschau auf der Karte. Mit «Route» siehst
            du pro Tag eine farbige Linie; die Tageskarten oben filtern die Karte auf einen
            Tag. Die Strecke ist Luftlinie zwischen den Fotos, nicht der gefahrene Weg.
          </p>
        </InfoCard>

        <InfoCard
          id="timeline"
          section="timeline"
          illustration={<CalendarArt className="size-20" />}
          title="Timeline und Sprachmemos"
        >
          <p>
            Die Timeline ordnet alle Aufnahmen nach Reisetag. Zu jedem Tag kannst du eine
            Notiz schreiben oder ein Sprachmemo aufnehmen; Familie und Gäste sehen beides
            über den Gäste-Link.
          </p>
        </InfoCard>

        <InfoCard
          id="ki"
          section="more"
          illustration={<Sparkle className="size-20" />}
          title="KI-Funktionen"
        >
          <p>
            Auf einem Foto schlägt «KI-Vorschlag» Titel, Beschreibung und Tags vor; erst
            «Übernehmen» speichert sie. In der Galerie startet Enter im Suchfeld eine
            KI-Suche («Sonnenuntergang am Strand»). Im Rückblick schreibt die KI einen
            Reisebericht zum Kopieren und Teilen.
          </p>
          <p>
            Die KI braucht einen OpenAI-Schlüssel auf dem Server. Fehlt er, zeigt
            Photobuddy das an und alles andere funktioniert wie gewohnt.
          </p>
        </InfoCard>

        <InfoCard
          id="widgets"
          section="gallery"
          illustration={<PolaroidStack className="size-20" />}
          title="Widgets und Benachrichtigungen"
        >
          <p>
            Unter «Widgets» erzeugst du ein Skript für Scriptable: neueste Fotos, Zahlen und
            Route auf dem Homescreen von iPhone und iPad.
          </p>
          <p>
            Benachrichtigungen schaltest du in den Einstellungen ein. Wähle, ob jedes neue
            Foto sofort oder eine Zusammenfassung am Abend kommen soll.
          </p>
        </InfoCard>
      </main>
      <FloatingDock mode="teilnehmer" shareKey={null} />
    </div>
  );
}
