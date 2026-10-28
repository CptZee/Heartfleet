-- Run in Supabase SQL Editor. Never expose the service role key to the browser.
create extension if not exists pgcrypto;

create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  username text not null unique check (username ~ '^[a-z0-9_]{3,20}$'),
  password_hash text not null,
  email text,
  email_verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists users_email_unique on public.users (lower(email)) where email is not null;

create table if not exists public.sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index if not exists sessions_user_id_idx on public.sessions(user_id);
create index if not exists sessions_expires_at_idx on public.sessions(expires_at);

create table if not exists public.auth_rate_limits (
  key text primary key,
  attempts integer not null,
  window_started_at timestamptz not null
);

alter table public.users enable row level security;
alter table public.sessions enable row level security;
alter table public.auth_rate_limits enable row level security;
-- No public policies. Only the server-side service role can access these tables.
revoke all on public.users, public.sessions, public.auth_rate_limits from anon, authenticated;

create or replace function public.check_auth_rate_limit(p_key text, p_limit integer, p_window_seconds integer)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare n integer;
begin
  if p_limit < 1 or p_window_seconds < 1 then raise exception 'Invalid limit'; end if;
  insert into public.auth_rate_limits as r (key, attempts, window_started_at)
  values (p_key, 1, now())
  on conflict (key) do update set
    attempts = case when r.window_started_at <= now() - make_interval(secs => p_window_seconds) then 1 else r.attempts + 1 end,
    window_started_at = case when r.window_started_at <= now() - make_interval(secs => p_window_seconds) then now() else r.window_started_at end
  returning attempts into n;
  return n <= p_limit;
end;
$$;
revoke all on function public.check_auth_rate_limit(text,integer,integer) from public, anon, authenticated;
grant execute on function public.check_auth_rate_limit(text,integer,integer) to service_role;
ALTER TABLE public.users
DROP CONSTRAINT IF EXISTS users_username_check;

ALTER TABLE public.users
ADD CONSTRAINT users_username_check
CHECK (username ~ '^[a-zA-Z0-9_]{3,20}$');