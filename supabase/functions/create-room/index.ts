import { CreateRoomSchema, parseBody } from "../_shared/validate.ts";
import { adminClient } from "../_shared/db.ts";
import { respond, fail } from "../_shared/http.ts";
import { handlePreflight } from "../_shared/cors.ts";
import { generateRoomCode } from "../_shared/room-code.ts";
import { toPublicView, type PlayerRow, type RoomRow } from "../_shared/view.ts";

Deno.serve(async (req) => {
  const preflight = handlePreflight(req);
  if (preflight) return preflight;

  const parsed = await parseBody(req, CreateRoomSchema);
  if (!parsed.ok) return fail(400, "invalid_body", parsed.message);
  const { nickname, maxPlayers, penalty } = parsed.data;

  const db = adminClient();

  let room: RoomRow | null = null;
  for (let attempt = 0; attempt < 5 && !room; attempt++) {
    const code = generateRoomCode();
    const { data, error } = await db
      .from("rooms")
      .insert({ code, max_players: maxPlayers, penalty })
      .select()
      .single();
    if (!error) {
      room = data as RoomRow;
    } else if (error.code !== "23505") {
      // 一意制約違反(コード衝突)以外は即座に失敗させる
      return fail(500, "room_create_failed", error.message);
    }
  }
  if (!room) return fail(500, "room_create_failed", "ルームコードの採番に失敗しました");

  const { data: player, error: playerError } = await db
    .from("players")
    .insert({ room_id: room.id, seat_idx: 0, nickname })
    .select()
    .single();
  if (playerError || !player) {
    return fail(500, "player_create_failed", playerError?.message ?? "unknown error");
  }
  const playerRow = player as PlayerRow;

  return respond(200, {
    roomCode: room.code,
    seatIdx: 0,
    clientSecret: playerRow.client_secret,
    public: toPublicView(room, [playerRow]),
  });
});
