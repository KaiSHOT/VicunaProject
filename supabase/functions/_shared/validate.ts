import { z } from "npm:zod@3";

export const DecisionSchema = z.union([
  z.object({ type: z.literal("play"), cardId: z.number().int() }),
  z.object({ type: z.literal("draw") }),
  z.object({ type: z.literal("fold") }),
  z.object({ type: z.literal("reserve") }),
  z.object({ type: z.literal("pass") }),
]);

export const CreateRoomSchema = z.object({
  nickname: z.string().min(1).max(20),
  maxPlayers: z.number().int().min(2).max(6).default(6),
  penalty: z.number().int().min(0).default(5),
});

export const JoinRoomSchema = z.object({
  roomCode: z.string().min(1),
  nickname: z.string().min(1).max(20),
});

export const AddCpuPlayerSchema = z.object({
  roomCode: z.string().min(1),
  nickname: z.string().min(1).max(20).default("CPU"),
});

export const StartRoundSchema = z.object({
  roomCode: z.string().min(1),
  seatIdx: z.number().int(),
  clientSecret: z.string().uuid(),
  expectedTurnVersion: z.number().int(),
});

export const ApplyActionSchema = z.object({
  roomCode: z.string().min(1),
  seatIdx: z.number().int(),
  clientSecret: z.string().uuid(),
  expectedTurnVersion: z.number().int(),
  decision: DecisionSchema,
});

export const GetMyViewSchema = z.object({
  roomCode: z.string().min(1),
  seatIdx: z.number().int(),
  clientSecret: z.string().uuid(),
});

export async function parseBody<T>(
  req: Request,
  schema: { safeParse: (v: unknown) => { success: true; data: T } | { success: false; error: { message: string } } }
): Promise<{ ok: true; data: T } | { ok: false; message: string }> {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return { ok: false, message: "リクエストボディがJSONとして解釈できません" };
  }
  const parsed = schema.safeParse(json);
  if (!parsed.success) return { ok: false, message: parsed.error.message };
  return { ok: true, data: parsed.data };
}
