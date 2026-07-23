import { ApplyActionSchema, parseBody } from "../_shared/validate.ts";
import { adminClient } from "../_shared/db.ts";
import { respond, fail } from "../_shared/http.ts";
import { handlePreflight } from "../_shared/cors.ts";
import { toPublicView, toPrivateView, type PlayerRow, type RoomRow } from "../_shared/view.ts";
import { applyValidatedDecision } from "../_shared/game-actions.ts";
import { advanceCpuTurns } from "../_shared/cpu-turns.ts";
import { checkGameOverPlayer } from "../../../src/engine/rules.ts";
import type { Decision, GameState } from "../../../src/engine/types.ts";

Deno.serve(async (req) => {
  const preflight = handlePreflight(req);
  if (preflight) return preflight;

  const parsed = await parseBody(req, ApplyActionSchema);
  if (!parsed.ok) return fail(400, "invalid_body", parsed.message);
  const { roomCode, seatIdx, clientSecret, expectedTurnVersion, decision } = parsed.data;

  const db = adminClient();

  const { data: room, error: roomError } = await db.from("rooms").select("*").eq("code", roomCode).single();
  if (roomError || !room) return fail(404, "room_not_found", "ルームが見つかりません");
  const roomRow = room as RoomRow;

  if (roomRow.status !== "playing" || !roomRow.game_state) {
    return fail(409, "round_not_active", "ラウンドが開始されていません");
  }
  if (roomRow.turn_version !== expectedTurnVersion) {
    return fail(409, "turn_version_conflict", "状態が更新されています。最新状態を取得してください");
  }

  const { data: player, error: playerError } = await db
    .from("players")
    .select("*")
    .eq("room_id", roomRow.id)
    .eq("seat_idx", seatIdx)
    .single();
  if (playerError || !player) return fail(403, "forbidden", "座席が見つかりません");
  const playerRow = player as PlayerRow;
  if (playerRow.client_secret !== clientSecret) {
    return fail(403, "forbidden", "座席の認証に失敗しました");
  }

  const gs = roomRow.game_state as GameState;
  if (gs.currentPlayerIdx !== seatIdx) {
    return fail(409, "not_your_turn", "あなたの手番ではありません");
  }

  let nextGs: GameState;
  try {
    nextGs = applyValidatedDecision(gs, decision as Decision);
  } catch (e) {
    return fail(400, "illegal_action", e instanceof Error ? e.message : "不正な操作です");
  }

  const nextTurnVersion = expectedTurnVersion + 1;
  const winner = nextGs.roundOver ? checkGameOverPlayer(nextGs.players) : null;
  const nextStatus = winner ? "finished" : roomRow.status;

  const { data: updated, error: updateError } = await db
    .from("rooms")
    .update({
      game_state: nextGs,
      status: nextStatus,
      turn_version: nextTurnVersion,
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

  const { data: players } = await db.from("players").select("*").eq("room_id", roomRow.id);

  await db.from("action_log").insert({
    room_id: roomRow.id,
    round_no: roomRow.round_no,
    turn_version: nextTurnVersion,
    actor_seat_idx: seatIdx,
    action_type: decision.type,
    action_payload: decision,
    game_state_after: nextGs,
  });

  const playerRows = (players ?? []) as PlayerRow[];
  const publicView = toPublicView(updatedRoom, playerRows);

  await db.channel(`room:${roomCode}`).send({
    type: "broadcast",
    event: "state_changed",
    payload: publicView,
  });

  // 次の手番がCPU席なら、人間の入力を待たずにそのままサーバー側で自動進行させる。
  const cascade = await advanceCpuTurns(
    db,
    roomRow.id,
    roomCode,
    roomRow.round_no,
    playerRows,
    nextTurnVersion,
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
