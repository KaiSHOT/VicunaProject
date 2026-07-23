import { StartRoundSchema, parseBody } from "../_shared/validate.ts";
import { adminClient } from "../_shared/db.ts";
import { respond, fail } from "../_shared/http.ts";
import { handlePreflight } from "../_shared/cors.ts";
import { toPublicView, toPrivateView, type PlayerRow, type RoomRow } from "../_shared/view.ts";
import { advanceCpuTurns } from "../_shared/cpu-turns.ts";
import { checkGameOverPlayer, createBank, startRoundState } from "../../../src/engine/rules.ts";
import type { GameState, Player } from "../../../src/engine/types.ts";

Deno.serve(async (req) => {
  const preflight = handlePreflight(req);
  if (preflight) return preflight;

  const parsed = await parseBody(req, StartRoundSchema);
  if (!parsed.ok) return fail(400, "invalid_body", parsed.message);
  const { roomCode, seatIdx, clientSecret, expectedTurnVersion } = parsed.data;

  const db = adminClient();

  const { data: room, error: roomError } = await db.from("rooms").select("*").eq("code", roomCode).single();
  if (roomError || !room) return fail(404, "room_not_found", "ルームが見つかりません");
  const roomRow = room as RoomRow;

  if (roomRow.status === "finished") {
    return fail(409, "game_finished", "このルームのゲームは既に終了しています");
  }
  if (roomRow.turn_version !== expectedTurnVersion) {
    return fail(409, "turn_version_conflict", "状態が更新されています。最新状態を取得してください");
  }

  const { data: players, error: playersError } = await db
    .from("players")
    .select("*")
    .eq("room_id", roomRow.id)
    .order("seat_idx", { ascending: true });
  if (playersError || !players) {
    return fail(500, "players_fetch_failed", playersError?.message ?? "unknown error");
  }
  const playerRows = players as PlayerRow[];

  const requester = playerRows.find((p) => p.seat_idx === seatIdx);
  if (!requester || requester.client_secret !== clientSecret) {
    return fail(403, "forbidden", "座席の認証に失敗しました");
  }

  let nextGs: GameState;
  let nextRoundNo: number;

  if (roomRow.status === "lobby") {
    if (playerRows.length < 2) {
      return fail(409, "not_enough_players", "開始には2人以上が必要です");
    }
    const enginePlayers: Player[] = playerRows.map((p) => ({
      id: p.seat_idx,
      name: p.nickname,
      isAi: p.is_ai,
      hand: [],
      chips: [],
      folded: false,
      hasGoneOut: false,
    }));
    nextGs = startRoundState(enginePlayers, 0, roomRow.penalty, createBank());
    nextRoundNo = 1;
  } else {
    const gs = roomRow.game_state as GameState | null;
    if (!gs || !gs.roundOver) {
      return fail(409, "round_in_progress", "現在のラウンドがまだ終了していません");
    }
    if (checkGameOverPlayer(gs.players)) {
      return fail(409, "game_finished", "このゲームは既に終了しています");
    }
    const startIdx =
      gs.roundResult && gs.roundResult.outPlayerId !== null
        ? gs.players.findIndex((p) => p.id === gs.roundResult!.outPlayerId)
        : 0;
    nextGs = startRoundState(gs.players, startIdx, gs.penalty, gs.bank);
    nextRoundNo = roomRow.round_no + 1;
  }

  const { data: updated, error: updateError } = await db
    .from("rooms")
    .update({
      game_state: nextGs,
      round_no: nextRoundNo,
      status: "playing",
      turn_version: expectedTurnVersion + 1,
      updated_at: new Date().toISOString(),
    })
    .eq("id", roomRow.id)
    .eq("turn_version", expectedTurnVersion)
    .select()
    .single();
  if (updateError || !updated) {
    return fail(409, "turn_version_conflict", "他の操作が先に処理されました");
  }
  const updatedRoom = updated as RoomRow;

  await db.from("action_log").insert({
    room_id: roomRow.id,
    round_no: nextRoundNo,
    turn_version: updatedRoom.turn_version,
    actor_seat_idx: seatIdx,
    action_type: "round_start",
    action_payload: { type: "round_start" },
    game_state_after: nextGs,
  });

  const publicView = toPublicView(updatedRoom, playerRows);

  await db.channel(`room:${roomCode}`).send({
    type: "broadcast",
    event: "state_changed",
    payload: publicView,
  });

  // ラウンド最初の手番がCPU席なら、そのままサーバー側で自動進行させる。
  const cascade = await advanceCpuTurns(
    db,
    roomRow.id,
    roomCode,
    nextRoundNo,
    playerRows,
    updatedRoom.turn_version,
    nextGs
  );
  const finalRoom: RoomRow = {
    ...updatedRoom,
    game_state: cascade.gs,
    turn_version: cascade.turnVersion,
    status: cascade.status,
  };

  return respond(200, {
    public: toPublicView(finalRoom, playerRows),
    private: toPrivateView(cascade.gs, seatIdx),
  });
});
