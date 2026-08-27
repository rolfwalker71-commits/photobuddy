import Link from "next/link";
import { Camera, MapPinned, Users } from "lucide-react";

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-lg flex-col justify-center px-5 py-12">
      <p className="text-sm font-medium uppercase tracking-[0.14em] text-primary">
        Reise-Tagebuch
      </p>
      <h1 className="mt-2 text-4xl font-semibold leading-tight break-words">
        Photobuddy
      </h1>
      <p className="mt-3 text-base leading-relaxed text-muted-foreground">
        Vier Leute, eine Reise, ein gemeinsames Album — mit Karte, Timeline und
        einem Link für Familie und Freunde.
      </p>

      <ul className="mt-8 space-y-3">
        {[
          {
            icon: Camera,
            title: "Fotos unterwegs",
            text: "Direkt aus der App fotografieren oder aus der Galerie laden. EXIF und GPS kommen automatisch mit.",
          },
          {
            icon: MapPinned,
            title: "Karte & Timeline",
            text: "Jedes Bild mit Standort erscheint auf der Weltkarte. Die Timeline sortiert nach Aufnahmedatum.",
          },
          {
            icon: Users,
            title: "Gäste ohne Login",
            text: "Teile einen Link. Familie darf schauen, filtern, kommentieren und Emojis da lassen.",
          },
        ].map((item) => (
          <li
            key={item.title}
            className="flex gap-3 rounded-2xl bg-card p-4 shadow-card ring-1 ring-border"
          >
            <item.icon className="mt-0.5 size-5 shrink-0 text-primary" />
            <div>
              <p className="font-medium leading-snug">{item.title}</p>
              <p className="mt-1 text-sm text-muted-foreground leading-snug">
                {item.text}
              </p>
            </div>
          </li>
        ))}
      </ul>

      <div className="mt-8 flex flex-col gap-3">
        <Link
          href="/login"
          className="inline-flex h-11 items-center justify-center rounded-2xl bg-primary text-sm font-medium text-primary-foreground"
        >
          Als Teilnehmer anmelden
        </Link>
        <p className="text-center text-sm text-muted-foreground leading-snug">
          Du hast einen Gäste-Link? Öffne ihn direkt — ein Login ist nicht nötig.
        </p>
      </div>
    </main>
  );
}
