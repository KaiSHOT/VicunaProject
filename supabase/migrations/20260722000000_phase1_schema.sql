-- フェーズ1: バックエンド基盤（ルーム／プレイヤー／1手ごとの履歴ログ）
--
-- 設計方針:
-- - game_state（他プレイヤーの手札を含む完全なGameState）はservice-roleのみが
--   アクセスできる前提とする。RLSを有効化しポリシーを一切追加しないことで、
--   匿名/認証ロールからの直接アクセスを遮断する（読み書きともにEdge Functions経由のみ）。
-- - 座席の認証はclient_secretで行う（ログインなし方針のため、Supabase Authは使わない）。
-- - 1手ごとの履歴は差分ではなくgame_stateのフルスナップショットで保存する
--   （ターン制・低頻度更新のためJSONBコストは無視できる規模。分析用途で
--   その時点の全情報を復元しやすくするため）。

create extension if not exists pgcrypto;

create table public.rooms (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  status text not null default 'lobby'
    check (status in ('lobby', 'playing', 'finished')),
  max_players int not null default 6 check (max_players between 2 and 6),
  penalty int not null default 5,
  round_no int not null default 0,
  turn_version bigint not null default 0,
  game_state jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.players (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms (id) on delete cascade,
  seat_idx int not null,
  nickname text not null,
  is_ai boolean not null default false,
  is_connected boolean not null default true,
  client_secret uuid not null default gen_random_uuid(),
  joined_at timestamptz not null default now(),
  unique (room_id, seat_idx)
);

create table public.action_log (
  id bigserial primary key,
  room_id uuid not null references public.rooms (id) on delete cascade,
  round_no int not null,
  turn_version bigint not null,
  actor_seat_idx int not null,
  action_type text not null
    check (action_type in ('play', 'draw', 'fold', 'reserve', 'pass', 'round_start')),
  action_payload jsonb not null default '{}'::jsonb,
  game_state_after jsonb not null,
  created_at timestamptz not null default now()
);

create index action_log_room_id_turn_idx
  on public.action_log (room_id, turn_version);

create index players_room_id_idx
  on public.players (room_id);

create unique index rooms_code_idx
  on public.rooms (code);

-- 匿名/認証ロール向けのポリシーは意図的に追加しない。
-- 全アクセスはservice_role（Edge Functions）経由のみに限定する。
alter table public.rooms enable row level security;
alter table public.players enable row level security;
alter table public.action_log enable row level security;

-- service_roleはBYPASSRLSだが、テーブル自体への権限がデフォルトでは
-- 付与されないため（migrationはpostgresロールとして実行され、
-- supabase_admin向けのdefault privilegesが適用されないため）明示的に付与する。
grant usage on schema public to service_role;
grant select, insert, update, delete on public.rooms, public.players, public.action_log to service_role;
grant usage, select on all sequences in schema public to service_role;

-- 同時入室の競合防止: rooms行をFOR UPDATEでロックしてから空き座席数を数えて採番する。
-- supabase-jsのクエリビルダーでは明示的な行ロックを表現できないため、RPCとして実装する。
create or replace function public.join_room(p_room_code text, p_nickname text)
returns table (out_room_id uuid, out_seat_idx int, out_client_secret uuid) as $$
declare
  v_room public.rooms%rowtype;
  v_count int;
  v_seat int;
  v_secret uuid;
begin
  select * into v_room from public.rooms where code = p_room_code for update;
  if not found then
    raise exception 'room_not_found';
  end if;
  if v_room.status <> 'lobby' then
    raise exception 'room_not_in_lobby';
  end if;

  select count(*) into v_count from public.players where room_id = v_room.id;
  if v_count >= v_room.max_players then
    raise exception 'room_full';
  end if;

  v_seat := v_count;
  v_secret := gen_random_uuid();
  insert into public.players (room_id, seat_idx, nickname, client_secret)
  values (v_room.id, v_seat, p_nickname, v_secret);

  return query select v_room.id, v_seat, v_secret;
end;
$$ language plpgsql;
