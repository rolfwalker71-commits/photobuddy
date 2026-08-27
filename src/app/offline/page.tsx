export default function OfflinePage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-5 text-center">
      <h1 className="text-2xl font-semibold">Du bist offline</h1>
      <p className="mt-2 text-sm text-muted-foreground leading-snug">
        Photobuddy braucht eine Verbindung, um neue Fotos zu laden. Schon
        angesehene Bilder können im Cache liegen.
      </p>
    </main>
  );
}
