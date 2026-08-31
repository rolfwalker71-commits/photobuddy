-- Global app settings (key/value). map_style defaults to Carto Voyager.

create table if not exists public.app_settings (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);

insert into public.app_settings (key, value)
values ('map_style', 'voyager')
on conflict (key) do nothing;
