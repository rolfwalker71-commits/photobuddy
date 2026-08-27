-- Photobuddy schema. Applied on first app start (and by npm run create-user if needed).

create extension if not exists "pgcrypto";

create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  password_hash text not null,
  display_name text not null,
  avatar_url text,
  role text not null default 'teilnehmer' check (role in ('teilnehmer')),
  accent_color text not null default '#0f766e',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.photos (
  id uuid primary key default gen_random_uuid(),
  uploaded_by uuid not null references public.users (id) on delete restrict,
  storage_path text not null,
  thumbnail_path text,
  title text,
  description text,
  taken_at timestamptz,
  latitude double precision,
  longitude double precision,
  location_name text,
  width integer,
  height integer,
  mime_type text,
  file_size integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists photos_taken_at_idx on public.photos (taken_at desc nulls last);
create index if not exists photos_uploaded_by_idx on public.photos (uploaded_by);
create index if not exists photos_created_at_idx on public.photos (created_at desc);
create index if not exists photos_location_idx on public.photos (location_name);

create table if not exists public.tags (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists public.photo_tags (
  photo_id uuid not null references public.photos (id) on delete cascade,
  tag_id uuid not null references public.tags (id) on delete cascade,
  primary key (photo_id, tag_id)
);

create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  photo_id uuid not null references public.photos (id) on delete cascade,
  author_id uuid references public.users (id) on delete set null,
  guest_name text,
  guest_session_id uuid,
  body text not null check (char_length(trim(body)) between 1 and 2000),
  created_at timestamptz not null default now(),
  constraint comments_author_xor_guest check (
    (author_id is not null and guest_name is null)
    or (author_id is null and guest_name is not null)
  )
);

create index if not exists comments_photo_id_idx on public.comments (photo_id, created_at);

create table if not exists public.reactions (
  id uuid primary key default gen_random_uuid(),
  photo_id uuid not null references public.photos (id) on delete cascade,
  author_id uuid references public.users (id) on delete cascade,
  guest_name text,
  guest_session_id uuid,
  emoji text not null check (char_length(emoji) between 1 and 16),
  created_at timestamptz not null default now(),
  constraint reactions_author_xor_guest check (
    (author_id is not null and guest_session_id is null)
    or (author_id is null and guest_session_id is not null)
  )
);

create unique index if not exists reactions_auth_unique
  on public.reactions (photo_id, author_id, emoji)
  where author_id is not null;

create unique index if not exists reactions_guest_unique
  on public.reactions (photo_id, guest_session_id, emoji)
  where guest_session_id is not null;

create index if not exists reactions_photo_id_idx on public.reactions (photo_id);

create table if not exists public.share_links (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  label text not null default 'Familien-Link',
  is_active boolean not null default true,
  created_by uuid references public.users (id) on delete set null,
  created_at timestamptz not null default now(),
  expires_at timestamptz
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists users_set_updated_at on public.users;
create trigger users_set_updated_at
  before update on public.users
  for each row execute function public.set_updated_at();

drop trigger if exists photos_set_updated_at on public.photos;
create trigger photos_set_updated_at
  before update on public.photos
  for each row execute function public.set_updated_at();

insert into public.share_links (key, label, is_active)
select encode(gen_random_bytes(24), 'hex'), 'Familien-Link', true
where not exists (select 1 from public.share_links);
