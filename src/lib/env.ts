export type PublicEnv = {
  NEXT_PUBLIC_SUPABASE_URL: string;
  NEXT_PUBLIC_SUPABASE_ANON_KEY: string;
  NEXT_PUBLIC_SITE_URL: string;
  NEXT_PUBLIC_VAPID_PUBLIC_KEY: string;
};

declare global {
  interface Window {
    __PHOTOBUDDY_ENV__?: Partial<PublicEnv>;
  }
}

function read(name: keyof PublicEnv): string {
  if (typeof window !== "undefined" && window.__PHOTOBUDDY_ENV__?.[name]) {
    return window.__PHOTOBUDDY_ENV__[name] ?? "";
  }
  return process.env[name] ?? "";
}

export function getPublicEnv(): PublicEnv {
  return {
    NEXT_PUBLIC_SUPABASE_URL: read("NEXT_PUBLIC_SUPABASE_URL"),
    NEXT_PUBLIC_SUPABASE_ANON_KEY: read("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
    NEXT_PUBLIC_SITE_URL: read("NEXT_PUBLIC_SITE_URL"),
    NEXT_PUBLIC_VAPID_PUBLIC_KEY: read("NEXT_PUBLIC_VAPID_PUBLIC_KEY"),
  };
}

export function getSiteUrl() {
  const fromEnv = getPublicEnv().NEXT_PUBLIC_SITE_URL;
  if (fromEnv) return fromEnv.replace(/\/$/, "");
  if (typeof window !== "undefined") return window.location.origin;
  return "http://localhost:3388";
}
