-- Admin-Rolle und deaktivierbare Konten.

do $$
declare
  cname text;
begin
  select conname into cname
  from pg_constraint
  where conrelid = 'public.users'::regclass
    and contype = 'c'
    and pg_get_constraintdef(oid) ilike '%role%';
  if cname is not null then
    execute format('alter table public.users drop constraint %I', cname);
  end if;
end $$;

alter table public.users add constraint users_role_check
  check (role in ('teilnehmer', 'admin'));

alter table public.users
  add column if not exists is_active boolean not null default true;
