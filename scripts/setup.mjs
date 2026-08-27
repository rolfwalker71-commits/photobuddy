import { copyFileSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const dest = resolve(root, ".env");
const src = resolve(root, ".env.example");

if (!existsSync(dest)) {
  copyFileSync(src, dest);
  console.log("OK  .env angelegt aus .env.example");
} else {
  console.log("OK  .env ist schon da");
}

console.log(`
Photobuddy — das musst du selbst machen (geht nicht automatisch):

  1. supabase.com → neues Projekt
  2. SQL Editor: supabase/migrations/00001_init.sql einmal ausführen
  3. Auth → URL Configuration
       Site URL       http://localhost:3388
       Redirect URLs  http://localhost:3388/**  und  /auth/callback
  4. Auth → Users: 4 Teilnehmer (E-Mail + Passwort)
  5. .env: NEXT_PUBLIC_SUPABASE_URL und NEXT_PUBLIC_SUPABASE_ANON_KEY
     (Project Settings → API). SITE_URL ist schon gesetzt.
  6. npm install && npm run dev
     → http://localhost:3388

Überspringen: Docker, supabase start, lokale DB, VAPID, seed.sql
Server später: gleicher Supabase, NEXT_PUBLIC_SITE_URL = öffentliche URL,
  docker compose pull && docker compose up -d
  (GHCR-Image erst nach Commit + Push auf main)
`);
