-- Homescreen widgets (Scriptable on iOS/iPadOS).
--
-- The widget runs on the phone without a session cookie, so each Teilnehmer
-- gets a personal token that stands in for the login. It is read-only by
-- construction: the widget endpoints never write anything, and the token is
-- rotatable from Einstellungen → Widgets if a script ever leaks.
alter table public.users
  add column if not exists widget_token text;

alter table public.users
  add column if not exists widget_settings text;

-- Partial, so the many users without a token do not collide on NULL.
create unique index if not exists users_widget_token_key
  on public.users (widget_token)
  where widget_token is not null;
