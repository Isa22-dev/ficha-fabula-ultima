create extension if not exists pgcrypto;

create table if not exists public.fichas_rpg (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  nome text,
  classe text,
  nivel integer default 1,
  tema text,
  origem text,
  personagem jsonb not null default '{}'::jsonb,
  retrato text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists fichas_rpg_user_id_idx on public.fichas_rpg(user_id);
create index if not exists fichas_rpg_updated_at_idx on public.fichas_rpg(updated_at desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_fichas_rpg_updated_at on public.fichas_rpg;

create trigger set_fichas_rpg_updated_at
before update on public.fichas_rpg
for each row
execute function public.set_updated_at();

alter table public.fichas_rpg enable row level security;

drop policy if exists "select_own_fichas_rpg" on public.fichas_rpg;
drop policy if exists "insert_own_fichas_rpg" on public.fichas_rpg;
drop policy if exists "update_own_fichas_rpg" on public.fichas_rpg;
drop policy if exists "delete_own_fichas_rpg" on public.fichas_rpg;

create policy "select_own_fichas_rpg"
on public.fichas_rpg
for select
to authenticated
using (auth.uid() = user_id);

create policy "insert_own_fichas_rpg"
on public.fichas_rpg
for insert
to authenticated
with check (auth.uid() = user_id);

create policy "update_own_fichas_rpg"
on public.fichas_rpg
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "delete_own_fichas_rpg"
on public.fichas_rpg
for delete
to authenticated
using (auth.uid() = user_id);
