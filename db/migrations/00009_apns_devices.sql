-- Native iOS app: APNs device tokens (parallel to push_subscriptions for Web Push).
create table if not exists public.apns_devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  token text not null unique,
  environment text not null default 'production'
    check (environment in ('sandbox', 'production')),
  album_id uuid references public.albums (id) on delete cascade,
  notify_mode text not null default 'instant'
    check (notify_mode in ('instant', 'daily')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists apns_devices_user_idx on public.apns_devices (user_id);
create index if not exists apns_devices_album_idx on public.apns_devices (album_id);
