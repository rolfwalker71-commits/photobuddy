-- Photobuddy schema. Applied automatically by the migrate container on first start.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null,
  avatar_url text,
  role text not null default 'teilnehmer' check (role in ('teilnehmer')),
  accent_color text not null default '#0f766e',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.photos (
  id uuid primary key default gen_random_uuid(),
  uploaded_by uuid not null references public.profiles (id) on delete restrict,
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

create index photos_taken_at_idx on public.photos (taken_at desc nulls last);
create index photos_uploaded_by_idx on public.photos (uploaded_by);
create index photos_created_at_idx on public.photos (created_at desc);
create index photos_location_idx on public.photos (location_name);

create table public.tags (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz not null default now()
);

create table public.photo_tags (
  photo_id uuid not null references public.photos (id) on delete cascade,
  tag_id uuid not null references public.tags (id) on delete cascade,
  primary key (photo_id, tag_id)
);

create table public.comments (
  id uuid primary key default gen_random_uuid(),
  photo_id uuid not null references public.photos (id) on delete cascade,
  author_id uuid references public.profiles (id) on delete set null,
  guest_name text,
  guest_session_id uuid,
  body text not null check (char_length(trim(body)) between 1 and 2000),
  created_at timestamptz not null default now(),
  constraint comments_author_xor_guest check (
    (author_id is not null and guest_name is null)
    or (author_id is null and guest_name is not null)
  )
);

create index comments_photo_id_idx on public.comments (photo_id, created_at);

create table public.reactions (
  id uuid primary key default gen_random_uuid(),
  photo_id uuid not null references public.photos (id) on delete cascade,
  author_id uuid references public.profiles (id) on delete cascade,
  guest_name text,
  guest_session_id uuid,
  emoji text not null check (char_length(emoji) between 1 and 16),
  created_at timestamptz not null default now(),
  constraint reactions_author_xor_guest check (
    (author_id is not null and guest_session_id is null)
    or (author_id is null and guest_session_id is not null)
  )
);

create unique index reactions_auth_unique
  on public.reactions (photo_id, author_id, emoji)
  where author_id is not null;

create unique index reactions_guest_unique
  on public.reactions (photo_id, guest_session_id, emoji)
  where guest_session_id is not null;

create index reactions_photo_id_idx on public.reactions (photo_id);

create table public.share_links (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  label text not null default 'Familien-Link',
  is_active boolean not null default true,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  expires_at timestamptz
);

-- ---------------------------------------------------------------------------
-- updated_at trigger
-- ---------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

create trigger photos_set_updated_at
  before update on public.photos
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Auth: create a Teilnehmer profile on signup
-- ---------------------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, accent_color)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data ->> 'display_name',
      split_part(new.email, '@', 1)
    ),
    coalesce(new.raw_user_meta_data ->> 'accent_color', '#0f766e')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

create or replace function public.is_teilnehmer()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role = 'teilnehmer'
  );
$$;

create or replace function public.is_valid_share_key(p_key text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.share_links
    where key = p_key
      and is_active = true
      and (expires_at is null or expires_at > now())
  );
$$;

-- ---------------------------------------------------------------------------
-- Guest RPCs (anon + share key). Listing is never open to a bare anon key.
-- ---------------------------------------------------------------------------

create or replace function public.guest_validate_share(p_key text)
returns table (valid boolean, label text)
language sql
stable
security definer
set search_path = public
as $$
  select
    public.is_valid_share_key(p_key) as valid,
    (select sl.label from public.share_links sl where sl.key = p_key limit 1) as label;
$$;

create or replace function public.guest_list_photos(p_key text)
returns setof public.photos
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_valid_share_key(p_key) then
    raise exception 'invalid share key' using errcode = '42501';
  end if;
  return query
    select *
    from public.photos
    order by coalesce(taken_at, created_at) desc;
end;
$$;

create or replace function public.guest_get_photo(p_key text, p_photo_id uuid)
returns public.photos
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  rec public.photos;
begin
  if not public.is_valid_share_key(p_key) then
    raise exception 'invalid share key' using errcode = '42501';
  end if;
  select * into rec from public.photos where id = p_photo_id;
  if not found then
    raise exception 'not found' using errcode = 'P0002';
  end if;
  return rec;
end;
$$;

create or replace function public.guest_list_profiles(p_key text)
returns table (id uuid, display_name text, avatar_url text, accent_color text)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_valid_share_key(p_key) then
    raise exception 'invalid share key' using errcode = '42501';
  end if;
  return query
    select p.id, p.display_name, p.avatar_url, p.accent_color
    from public.profiles p
    order by p.display_name;
end;
$$;

create or replace function public.guest_list_tags(p_key text)
returns table (photo_id uuid, tag_id uuid, name text)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_valid_share_key(p_key) then
    raise exception 'invalid share key' using errcode = '42501';
  end if;
  return query
    select pt.photo_id, t.id, t.name
    from public.photo_tags pt
    join public.tags t on t.id = pt.tag_id;
end;
$$;

create or replace function public.guest_list_comments(p_key text, p_photo_id uuid)
returns table (
  id uuid,
  photo_id uuid,
  author_id uuid,
  guest_name text,
  body text,
  created_at timestamptz,
  author_display_name text
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_valid_share_key(p_key) then
    raise exception 'invalid share key' using errcode = '42501';
  end if;
  return query
    select
      c.id,
      c.photo_id,
      c.author_id,
      c.guest_name,
      c.body,
      c.created_at,
      p.display_name
    from public.comments c
    left join public.profiles p on p.id = c.author_id
    where c.photo_id = p_photo_id
    order by c.created_at asc;
end;
$$;

create or replace function public.guest_list_reactions(p_key text, p_photo_id uuid)
returns table (id uuid, photo_id uuid, emoji text, guest_name text, author_id uuid)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_valid_share_key(p_key) then
    raise exception 'invalid share key' using errcode = '42501';
  end if;
  return query
    select r.id, r.photo_id, r.emoji, r.guest_name, r.author_id
    from public.reactions r
    where r.photo_id = p_photo_id;
end;
$$;

create or replace function public.guest_add_comment(
  p_key text,
  p_photo_id uuid,
  p_guest_name text,
  p_guest_session_id uuid,
  p_body text
)
returns public.comments
language plpgsql
security definer
set search_path = public
as $$
declare
  rec public.comments;
begin
  if not public.is_valid_share_key(p_key) then
    raise exception 'invalid share key' using errcode = '42501';
  end if;
  if p_guest_session_id is null then
    raise exception 'guest session required' using errcode = '22023';
  end if;
  if char_length(trim(coalesce(p_guest_name, ''))) < 2 then
    raise exception 'guest name required' using errcode = '22023';
  end if;
  if not exists (select 1 from public.photos where id = p_photo_id) then
    raise exception 'not found' using errcode = 'P0002';
  end if;

  insert into public.comments (photo_id, guest_name, guest_session_id, body)
  values (
    p_photo_id,
    left(trim(p_guest_name), 80),
    p_guest_session_id,
    left(trim(p_body), 2000)
  )
  returning * into rec;

  return rec;
end;
$$;

create or replace function public.guest_toggle_reaction(
  p_key text,
  p_photo_id uuid,
  p_guest_name text,
  p_guest_session_id uuid,
  p_emoji text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  existing uuid;
begin
  if not public.is_valid_share_key(p_key) then
    raise exception 'invalid share key' using errcode = '42501';
  end if;
  if p_guest_session_id is null or char_length(trim(coalesce(p_emoji, ''))) < 1 then
    raise exception 'invalid reaction' using errcode = '22023';
  end if;

  select id into existing
  from public.reactions
  where photo_id = p_photo_id
    and guest_session_id = p_guest_session_id
    and emoji = p_emoji;

  if existing is not null then
    delete from public.reactions where id = existing;
    return false;
  end if;

  insert into public.reactions (photo_id, guest_name, guest_session_id, emoji)
  values (
    p_photo_id,
    left(trim(coalesce(p_guest_name, 'Gast')), 80),
    p_guest_session_id,
    left(trim(p_emoji), 16)
  );
  return true;
end;
$$;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.photos enable row level security;
alter table public.tags enable row level security;
alter table public.photo_tags enable row level security;
alter table public.comments enable row level security;
alter table public.reactions enable row level security;
alter table public.share_links enable row level security;

-- Profiles: participants can read everyone and update themselves
create policy profiles_select_teilnehmer
  on public.profiles for select
  to authenticated
  using (public.is_teilnehmer());

create policy profiles_update_own
  on public.profiles for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid() and role = 'teilnehmer');

-- Photos: full access for Teilnehmer (edit/delete any trip photo)
create policy photos_select_teilnehmer
  on public.photos for select
  to authenticated
  using (public.is_teilnehmer());

create policy photos_insert_teilnehmer
  on public.photos for insert
  to authenticated
  with check (public.is_teilnehmer() and uploaded_by = auth.uid());

create policy photos_update_teilnehmer
  on public.photos for update
  to authenticated
  using (public.is_teilnehmer())
  with check (public.is_teilnehmer());

create policy photos_delete_teilnehmer
  on public.photos for delete
  to authenticated
  using (public.is_teilnehmer());

-- Tags
create policy tags_select_teilnehmer
  on public.tags for select
  to authenticated
  using (public.is_teilnehmer());

create policy tags_insert_teilnehmer
  on public.tags for insert
  to authenticated
  with check (public.is_teilnehmer());

create policy photo_tags_all_teilnehmer
  on public.photo_tags for all
  to authenticated
  using (public.is_teilnehmer())
  with check (public.is_teilnehmer());

-- Comments: Teilnehmer read/write/delete; guests only via RPC
create policy comments_select_teilnehmer
  on public.comments for select
  to authenticated
  using (public.is_teilnehmer());

create policy comments_insert_teilnehmer
  on public.comments for insert
  to authenticated
  with check (public.is_teilnehmer() and author_id = auth.uid() and guest_name is null);

create policy comments_delete_teilnehmer
  on public.comments for delete
  to authenticated
  using (public.is_teilnehmer());

-- Reactions
create policy reactions_select_teilnehmer
  on public.reactions for select
  to authenticated
  using (public.is_teilnehmer());

create policy reactions_insert_teilnehmer
  on public.reactions for insert
  to authenticated
  with check (public.is_teilnehmer() and author_id = auth.uid());

create policy reactions_delete_own_or_all
  on public.reactions for delete
  to authenticated
  using (public.is_teilnehmer());

-- Share links: only Teilnehmer may manage invite links
create policy share_links_select_teilnehmer
  on public.share_links for select
  to authenticated
  using (public.is_teilnehmer());

create policy share_links_insert_teilnehmer
  on public.share_links for insert
  to authenticated
  with check (public.is_teilnehmer());

create policy share_links_update_teilnehmer
  on public.share_links for update
  to authenticated
  using (public.is_teilnehmer())
  with check (public.is_teilnehmer());

-- ---------------------------------------------------------------------------
-- Grants for guest RPCs
-- ---------------------------------------------------------------------------

grant usage on schema public to anon, authenticated;

grant select, insert, update, delete on public.profiles to authenticated;
grant select, insert, update, delete on public.photos to authenticated;
grant select, insert, update, delete on public.tags to authenticated;
grant select, insert, update, delete on public.photo_tags to authenticated;
grant select, insert, delete on public.comments to authenticated;
grant select, insert, delete on public.reactions to authenticated;
grant select, insert, update on public.share_links to authenticated;

grant execute on function public.is_teilnehmer() to authenticated;
grant execute on function public.is_valid_share_key(text) to anon, authenticated;
grant execute on function public.guest_validate_share(text) to anon, authenticated;
grant execute on function public.guest_list_photos(text) to anon, authenticated;
grant execute on function public.guest_get_photo(text, uuid) to anon, authenticated;
grant execute on function public.guest_list_profiles(text) to anon, authenticated;
grant execute on function public.guest_list_tags(text) to anon, authenticated;
grant execute on function public.guest_list_comments(text, uuid) to anon, authenticated;
grant execute on function public.guest_list_reactions(text, uuid) to anon, authenticated;
grant execute on function public.guest_add_comment(text, uuid, text, uuid, text) to anon, authenticated;
grant execute on function public.guest_toggle_reaction(text, uuid, text, uuid, text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Storage: public-read by object path, write only for Teilnehmer
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'photos',
  'photos',
  true,
  15728640,
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

create policy photos_bucket_insert_teilnehmer
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'photos'
    and public.is_teilnehmer()
  );

create policy photos_bucket_update_teilnehmer
  on storage.objects for update
  to authenticated
  using (bucket_id = 'photos' and public.is_teilnehmer())
  with check (bucket_id = 'photos' and public.is_teilnehmer());

create policy photos_bucket_delete_teilnehmer
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'photos' and public.is_teilnehmer());

-- Public bucket serves files by URL; do not grant listing to anon.

-- ---------------------------------------------------------------------------
-- Gäste-Link (ein zufälliger Key). Nach Run in den Query-Results merken
-- oder später in der App unter Einstellungen kopieren.
-- ---------------------------------------------------------------------------

insert into public.share_links (key, label, is_active)
select encode(gen_random_bytes(24), 'hex'), 'Familien-Link', true
where not exists (select 1 from public.share_links);

select key as gast_link_key, label
from public.share_links
where is_active;
