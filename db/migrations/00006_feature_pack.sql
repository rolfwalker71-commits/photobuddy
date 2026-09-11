-- Voice notes, short videos, weather, trash, duplicate hash.

alter table public.photos
  add column if not exists kind text not null default 'photo';

alter table public.photos
  drop constraint if exists photos_kind_check;

alter table public.photos
  add constraint photos_kind_check check (kind in ('photo', 'video'));

alter table public.photos
  add column if not exists duration_ms integer;

alter table public.photos
  add column if not exists weather_temp_c double precision;

alter table public.photos
  add column if not exists weather_code integer;

alter table public.photos
  add column if not exists deleted_at timestamptz;

alter table public.photos
  add column if not exists content_hash text;

create index if not exists photos_album_visible_idx
  on public.photos (album_id, coalesce(taken_at, created_at) desc)
  where deleted_at is null;

create index if not exists photos_album_trash_idx
  on public.photos (album_id, deleted_at desc)
  where deleted_at is not null;

create index if not exists photos_album_hash_idx
  on public.photos (album_id, content_hash)
  where content_hash is not null and deleted_at is null;

create table if not exists public.day_voice_notes (
  id uuid primary key default gen_random_uuid(),
  album_id uuid not null references public.albums (id) on delete cascade,
  note_date date not null,
  author_id uuid not null references public.users (id) on delete restrict,
  storage_path text not null,
  duration_ms integer not null check (duration_ms > 0 and duration_ms <= 20000),
  mime_type text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (album_id, note_date)
);

create index if not exists day_voice_notes_album_date_idx
  on public.day_voice_notes (album_id, note_date);

drop trigger if exists day_voice_notes_set_updated_at on public.day_voice_notes;
create trigger day_voice_notes_set_updated_at
  before update on public.day_voice_notes
  for each row execute function public.set_updated_at();
