import { JoinRoomSchema, parseBody } from "../_shared/validate.ts";
import { adminClient } from "../_shared/db.ts";
import { respond, fail } from "../_shared/http.ts";
import { handlePreflight } from "../_shared/cors.ts";
import { toPublicView, type PlayerRow, type RoomRow } from "../_shared/view.ts";

interface JoinRoomRpcResult {
  out_room_id: string;
  out_seat_idx: number;
  out_client_secret: string;
}

Deno.serve(async (req) => {
  const preflight = handlePreflight(req);
  if (preflight) return preflight;

  const parsed = await parseBody(req, JoinRoomSchema);
  if (!parsed.ok) return fail(400, "invalid_body", parsed.message);
  const { roomCode, nickname } = parsed.data;

  const db = adminClient();

  // 同時入室の競合はjoin_room RPC内のFOR UPDATEロックで解決する
  const { data: joinResult, error: joinError } = await db
    .rpc("join_room", { p_room_code: roomCode, p_nickname: nickname })
    .single();

  if (joinError || !joinResult) {
    const message = joinError?.message ?? "";
    if (message.includes("room_not_found")) return fail(404, "room_not_found", "ルームが見つかりません");
    if (message.includes("room_not_in_lobby")) {
      return fail(409, "room_not_in_lobby", "このルームは既に開始されています");
    }
    if (message.includes("room_full")) return fail(409, "room_full", "ルームが満員です");
    return fail(500, "join_failed", message || "参加処理に失敗しました");
  }

  const { out_room_id: roomId, out_seat_idx: seatIdx, out_client_secret: clientSecret } =
    joinResult as JoinRoomRpcResult;

  const { data: room, error: roomError } = await db
    .from("rooms")
    .select("*")
    .eq("id", roomId)
    .single();
  if (roomError || !room) return fail(500, "room_fetch_failed", roomError?.message ?? "unknown error");

  const { data: players, error: playersError } = await db
    .from("players")
    .select("*")
    .eq("room_id", roomId);
  if (playersError || !players) {
    return fail(500, "players_fetch_failed", playersError?.message ?? "unknown error");
  }

  const roomRow = room as RoomRow;
  const publicView = toPublicView(roomRow, players as PlayerRow[]);

  await db.channel(`room:${roomCode}`).send({
    type: "broadcast",
    event: "state_changed",
    payload: publicView,
  });

  return respond(200, {
    roomCode: roomRow.code,
    seatIdx,
    clientSecret,
    public: publicView,
  });
});
