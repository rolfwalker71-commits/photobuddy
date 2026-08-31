-- Albums with members, photo ownership, and one guest share link per album.

create table if not exists public.albums (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.album_members (
  album_id uuid not null references public.albums (id) on delete cascade,
  user_id uuid not null references public.users (id) on delete cascade,
  primary key (album_id, user_id)
);

insert into public.albums (name)
select 'Reisetagebuch'
where not exists (select 1 from public.albums);

insert into public.album_members (album_id, user_id)
select a.id, u.id
from (select id from public.albums order by created_at asc limit 1) a
cross join public.users u
on conflict do nothing;

alter table public.photos
  add column if not exists album_id uuid references public.albums (id) on delete restrict;

update public.photos
set album_id = (select id from public.albums order by created_at asc limit 1)
where album_id is null;

alter table public.photos
  alter column album_id set not null;

create index if not exists photos_album_id_idx on public.photos (album_id);

alter table public.share_links
  add column if not exists album_id uuid references public.albums (id) on delete cascade;

update public.share_links
set album_id = (select id from public.albums order by created_at asc limit 1)
where album_id is null;

delete from public.share_links sl
where sl.album_id is not null
  and sl.id <> (
    select s2.id
    from public.share_links s2
    where s2.album_id = sl.album_id
    order by s2.created_at asc
    limit 1
  );

insert into public.share_links (key, label, is_active, album_id)
select encode(gen_random_bytes(24), 'hex'), 'Gäste-Link', true, a.id
from public.albums a
where not exists (
  select 1 from public.share_links sl where sl.album_id = a.id
);

create unique index if not exists share_links_album_unique
  on public.share_links (album_id);

drop trigger if exists albums_set_updated_at on public.albums;
create trigger albums_set_updated_at
  before update on public.albums
  for each row execute function public.set_updated_at();
