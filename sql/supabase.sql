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
create index if not exists fichas_rpg_local_id_idx on public.fichas_rpg((personagem->>'localId'));

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

create or replace function public.is_admin_user()
returns boolean
language sql
security definer
set search_path = public
as $$
select
  coalesce((auth.jwt() -> 'app_metadata' ->> 'is_admin')::boolean, false)
  or coalesce((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin', false)
  or coalesce((auth.jwt() -> 'user_metadata' ->> 'is_admin')::boolean, false)
  or coalesce((auth.jwt() -> 'user_metadata' ->> 'role') = 'admin', false);
$$;

create or replace function public.get_ficha_visivel(p_ficha_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ficha public.fichas_rpg;
  v_user_id uuid := auth.uid();
  v_is_admin boolean := public.is_admin_user();
begin
  select * into v_ficha from public.fichas_rpg where id = p_ficha_id;

  if not found then
    return jsonb_build_object('id', p_ficha_id, 'nome', 'Ficha não encontrada', 'modo', 'publico', 'recursos', '{}'::jsonb);
  end if;

  if v_user_id = v_ficha.user_id or v_is_admin then
    return to_jsonb(v_ficha);
  end if;

  return jsonb_build_object(
    'id', v_ficha.id,
    'user_id', v_ficha.user_id,
    'nome', v_ficha.nome,
    'retrato', v_ficha.retrato,
    'imagem', v_ficha.retrato,
    'modo', 'publico',
    'recursos', coalesce(v_ficha.personagem->'recursos', '{}'::jsonb)
  );
end;
$$;

create or replace function public.listar_fichas_visiveis()
returns table (
  id uuid,
  user_id uuid,
  nome text,
  classe text,
  nivel integer,
  tema text,
  origem text,
  retrato text,
  personagem jsonb,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_is_admin boolean := public.is_admin_user();
begin
  return query
  select
    f.id,
    f.user_id,
    f.nome,
    case when v_user_id = f.user_id or v_is_admin then f.classe else null end as classe,
    case when v_user_id = f.user_id or v_is_admin then f.nivel else null end as nivel,
    case when v_user_id = f.user_id or v_is_admin then f.tema else null end as tema,
    case when v_user_id = f.user_id or v_is_admin then f.origem else null end as origem,
    case when v_user_id = f.user_id or v_is_admin then f.retrato else null end as retrato,
    case
      when v_user_id = f.user_id or v_is_admin then f.personagem
      else jsonb_build_object(
        'identidade', jsonb_build_object('nome', f.nome),
        'recursos', coalesce(f.personagem->'recursos', '{}'::jsonb)
      )
    end as personagem,
    f.updated_at
  from public.fichas_rpg f
  order by f.updated_at desc;
end;
$$;

grant execute on function public.is_admin_user() to authenticated;
grant execute on function public.get_ficha_visivel(uuid) to authenticated;
grant execute on function public.listar_fichas_visiveis() to authenticated;

drop trigger if exists set_fichas_rpg_updated_at on public.fichas_rpg;

create trigger set_fichas_rpg_updated_at
before update on public.fichas_rpg
for each row
execute function public.set_updated_at();

alter table public.fichas_rpg enable row level security;

drop policy if exists "select_own_fichas_rpg" on public.fichas_rpg;
drop policy if exists "select_admin_fichas_rpg" on public.fichas_rpg;
drop policy if exists "insert_own_fichas_rpg" on public.fichas_rpg;
drop policy if exists "update_own_fichas_rpg" on public.fichas_rpg;
drop policy if exists "update_admin_fichas_rpg" on public.fichas_rpg;
drop policy if exists "delete_own_fichas_rpg" on public.fichas_rpg;
drop policy if exists "delete_admin_fichas_rpg" on public.fichas_rpg;

create policy "select_own_fichas_rpg"
on public.fichas_rpg
for select
to authenticated
using (auth.uid() = user_id);

create policy "select_admin_fichas_rpg"
on public.fichas_rpg
for select
to authenticated
using (public.is_admin_user());

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

create policy "update_admin_fichas_rpg"
on public.fichas_rpg
for update
to authenticated
using (public.is_admin_user())
with check (public.is_admin_user());

create policy "delete_own_fichas_rpg"
on public.fichas_rpg
for delete
to authenticated
using (auth.uid() = user_id);

create policy "delete_admin_fichas_rpg"
on public.fichas_rpg
for delete
to authenticated
using (public.is_admin_user());

-- Tabela de Anotações de Sessão
create table if not exists public.anotacoes_sessao (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  conteudo text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists anotacoes_sessao_user_id_idx on public.anotacoes_sessao(user_id);
create index if not exists anotacoes_sessao_updated_at_idx on public.anotacoes_sessao(updated_at desc);

drop trigger if exists set_anotacoes_sessao_updated_at on public.anotacoes_sessao;

create trigger set_anotacoes_sessao_updated_at
before update on public.anotacoes_sessao
for each row
execute function public.set_updated_at();

alter table public.anotacoes_sessao enable row level security;

drop policy if exists "select_own_anotacoes_sessao" on public.anotacoes_sessao;
drop policy if exists "insert_own_anotacoes_sessao" on public.anotacoes_sessao;
drop policy if exists "update_own_anotacoes_sessao" on public.anotacoes_sessao;
drop policy if exists "delete_own_anotacoes_sessao" on public.anotacoes_sessao;

create policy "select_own_anotacoes_sessao"
on public.anotacoes_sessao
for select
to authenticated
using (auth.uid() = user_id);

create policy "insert_own_anotacoes_sessao"
on public.anotacoes_sessao
for insert
to authenticated
with check (auth.uid() = user_id);

create policy "update_own_anotacoes_sessao"
on public.anotacoes_sessao
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "delete_own_anotacoes_sessao"
on public.anotacoes_sessao
for delete
to authenticated
using (auth.uid() = user_id);
