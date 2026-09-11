-- Offline upload queue (idempotent retries) and daily push digest.

alter table public.photos
  add column if not exists client_upload_id uuid;

create unique index if not exists photos_client_upload_unique
  on public.photos (uploaded_by, client_upload_id)
  where client_upload_id is not null;

alter table public.push_subscriptions
  add column if not exists notify_mode text not null default 'instant';

alter table public.push_subscriptions
  drop constraint if exists push_subscriptions_notify_mode_check;

alter table public.push_subscriptions
  add constraint push_subscriptions_notify_mode_check
  check (notify_mode in ('instant', 'daily'));

-- Guests (family) get one evening summary instead of a push per photo.
update public.push_subscriptions
  set notify_mode = 'daily'
  where user_id is null;

create table if not exists public.push_digests (
  album_id uuid not null references public.albums (id) on delete cascade,
  digest_date date not null,
  photo_count integer not null default 0,
  sent_at timestamptz not null default now(),
  primary key (album_id, digest_date)
);

insert into public.app_settings (key, value)
values ('digest_hour', '20'), ('digest_time_zone', 'Europe/Zurich')
on conflict (key) do nothing;
