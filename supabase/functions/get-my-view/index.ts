import { GetMyViewSchema, parseBody } from "../_shared/validate.ts";
import { adminClient } from "../_shared/db.ts";
import { respond, fail } from "../_shared/http.ts";
import { handlePreflight } from "../_shared/cors.ts";
import { toPublicView, toPrivateView, type PlayerRow, type RoomRow } from "../_shared/view.ts";
import type { GameState } from "../../../src/engine/types.ts";

Deno.serve(async (req) => {
  const preflight = handlePreflight(req);
  if (preflight) return preflight;

  const parsed = await parseBody(req, GetMyViewSchema);
  if (!parsed.ok) return fail(400, "invalid_body", parsed.message);
  const { roomCode, seatIdx, clientSecret } = parsed.data;

  const db = adminClient();

  const { data: room, error: roomError } = await db.from("rooms").select("*").eq("code", roomCode).single();
  if (roomError || !room) return fail(404, "room_not_found", "ルームが見つかりません");
  const roomRow = room as RoomRow;

  const { data: players, error: playersError } = await db
    .from("players")
    .select("*")
    .eq("room_id", roomRow.id);
  if (playersError || !players) {
    return fail(500, "players_fetch_failed", playersError?.message ?? "unknown error");
  }
  const playerRows = players as PlayerRow[];

  const player = playerRows.find((p) => p.seat_idx === seatIdx);
  if (!player || player.client_secret !== clientSecret) {
    return fail(403, "forbidden", "座席の認証に失敗しました");
  }

  return respond(200, {
    public: toPublicView(roomRow, playerRows),
    private: toPrivateView(roomRow.game_state as GameState | null, seatIdx),
  });
});
