import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import { decideAiAction } from "../../../src/engine/ai.ts";
import { checkGameOverPlayer } from "../../../src/engine/rules.ts";
import type { GameState } from "../../../src/engine/types.ts";
import { applyValidatedDecision } from "./game-actions.ts";
import { toPublicView, type PlayerRow, type RoomRow } from "./view.ts";

// 暴走防止ガード。src/engine/simulation.tsのheadlessシミュレーションと同じ考え方
// （手番数の上限で打ち切る）で、ルール上は正常終了するはずだが念のため設ける。
const MAX_CPU_STEPS = 500;

export interface CpuCascadeResult {
  gs: GameState;
  turnVersion: number;
  status: "playing" | "finished";
}

// 現在の手番がCPU（isAi）である限り、smart AIで自動的に手番を進める。
// 予約宣言→即座の実行動という2手も、人間の場合と同じくapply-action相当の
// 1手＝1turn_version＝1action_log行という粒度を保ったまま進行させる。
export async function advanceCpuTurns(
  db: SupabaseClient,
  roomId: string,
  roomCode: string,
  roundNo: number,
  playerRows: PlayerRow[],
  turnVersion: number,
  gs: GameState
): Promise<CpuCascadeResult> {
  let cur = gs;
  let version = turnVersion;
  let status: "playing" | "finished" = "playing";
  let steps = 0;

  while (!cur.roundOver && cur.players[cur.currentPlayerIdx].isAi) {
    if (steps >= MAX_CPU_STEPS) {
      throw new Error("cpu_turn_guard_exceeded: CPUの手番進行が上限回数に達しました");
    }
    steps += 1;

    const actorSeatIdx = cur.currentPlayerIdx;
    const decision = decideAiAction(cur, "smart");
    const next = applyValidatedDecision(cur, decision);

    const winner = next.roundOver ? checkGameOverPlayer(next.players) : null;
    const nextStatus: "playing" | "finished" = winner ? "finished" : "playing";
    const nextVersion = version + 1;

    const { data: updated, error: updateError } = await db
      .from("rooms")
      .update({
        game_state: next,
        status: nextStatus,
        turn_version: nextVersion,
        updated_at: new Date().toISOString(),
      })
      .eq("id", roomId)
      .eq("turn_version", version)
      .select()
      .single();
    if (updateError || !updated) {
      throw new Error("cpu_turn_persist_failed: CPUの手番の保存に失敗しました");
    }

    await db.from("action_log").insert({
      room_id: roomId,
      round_no: roundNo,
      turn_version: nextVersion,
      actor_seat_idx: actorSeatIdx,
      action_type: decision.type,
      action_payload: decision,
      game_state_after: next,
    });

    const publicView = toPublicView(updated as RoomRow, playerRows);
    await db.channel(`room:${roomCode}`).send({
      type: "broadcast",
      event: "state_changed",
      payload: publicView,
    });

    cur = next;
    version = nextVersion;
    status = nextStatus;
  }

  return { gs: cur, turnVersion: version, status };
}
