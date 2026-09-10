-- Family-vacation album: highlights, last-seen, day notes, push, cover + dates.

alter table public.photos
  add column if not exists is_highlight boolean not null default false;

create index if not exists photos_album_highlight_idx
  on public.photos (album_id, is_highlight)
  where is_highlight = true;

alter table public.users
  add column if not exists last_seen_at timestamptz;

alter table public.albums
  add column if not exists cover_photo_id uuid references public.photos (id) on delete set null;

alter table public.albums
  add column if not exists starts_on date;

alter table public.albums
  add column if not exists ends_on date;

create table if not exists public.album_visits (
  id uuid primary key default gen_random_uuid(),
  album_id uuid not null references public.albums (id) on delete cascade,
  user_id uuid references public.users (id) on delete cascade,
  guest_session_id uuid,
  last_seen_at timestamptz not null default now(),
  constraint album_visits_viewer_xor check (
    (user_id is not null and guest_session_id is null)
    or (user_id is null and guest_session_id is not null)
  )
);

create unique index if not exists album_visits_user_unique
  on public.album_visits (album_id, user_id)
  where user_id is not null;

create unique index if not exists album_visits_guest_unique
  on public.album_visits (album_id, guest_session_id)
  where guest_session_id is not null;

create table if not exists public.day_notes (
  id uuid primary key default gen_random_uuid(),
  album_id uuid not null references public.albums (id) on delete cascade,
  note_date date not null,
  body text not null check (char_length(trim(body)) between 1 and 500),
  author_id uuid not null references public.users (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (album_id, note_date)
);

create index if not exists day_notes_album_date_idx
  on public.day_notes (album_id, note_date);

drop trigger if exists day_notes_set_updated_at on public.day_notes;
create trigger day_notes_set_updated_at
  before update on public.day_notes
  for each row execute function public.set_updated_at();

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_id uuid references public.users (id) on delete cascade,
  guest_session_id uuid,
  album_id uuid references public.albums (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists push_subscriptions_user_idx
  on public.push_subscriptions (user_id)
  where user_id is not null;

create index if not exists push_subscriptions_album_idx
  on public.push_subscriptions (album_id)
  where album_id is not null;

drop trigger if exists push_subscriptions_set_updated_at on public.push_subscriptions;
create trigger push_subscriptions_set_updated_at
  before update on public.push_subscriptions
  for each row execute function public.set_updated_at();
