-- フェーズ2: CPU席の追加に対応するため、join_room RPCにis_ai引数を追加する。
--
-- 既存のjoin_room呼び出し（人間の参加）はp_is_ai省略時にfalseとなり挙動は変わらない。
-- CPU席の追加（add-cpu-player Edge Function）はp_is_ai=trueで同じRPC・同じ
-- FOR UPDATEロックによる座席採番を再利用する（座席の同時採番ロジックを重複させない）。

-- create or replaceは引数リストが完全一致する場合のみ置き換えとなり、引数を追加すると
-- 別シグネチャの関数として共存してしまいPostgRESTのRPC呼び出しが曖昧になる。
-- 旧シグネチャを明示的に削除してから新シグネチャを作成する。
drop function if exists public.join_room(text, text);

create function public.join_room(p_room_code text, p_nickname text, p_is_ai boolean default false)
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
  insert into public.players (room_id, seat_idx, nickname, is_ai, client_secret)
  values (v_room.id, v_seat, p_nickname, p_is_ai, v_secret);

  return query select v_room.id, v_seat, v_secret;
end;
$$ language plpgsql;
