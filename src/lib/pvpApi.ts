import { FunctionsHttpError } from "@supabase/supabase-js";
import { getSupabase } from "./supabaseClient";
import type {
  AddCpuPlayerRequest,
  ApplyActionRequest,
  ActionLikeResponse,
  CreateRoomRequest,
  GetMyViewRequest,
  JoinLikeResponse,
  JoinRoomRequest,
  SeatAuthRequest,
} from "./pvpTypes";

export class PvpApiError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

async function invoke<T>(name: string, body: unknown): Promise<T> {
  const { data, error } = await getSupabase().functions.invoke(name, {
    body: body as Record<string, unknown>,
  });
  if (error) {
    if (error instanceof FunctionsHttpError) {
      const parsed = (await error.context.json().catch(() => null)) as
        | { error?: { code: string; message: string } }
        | null;
      if (parsed?.error) {
        throw new PvpApiError(parsed.error.code, parsed.error.message);
      }
    }
    throw new PvpApiError("unknown_error", error.message);
  }
  return data as T;
}

export function createRoom(req: CreateRoomRequest) {
  return invoke<JoinLikeResponse>("create-room", req);
}

export function joinRoom(req: JoinRoomRequest) {
  return invoke<JoinLikeResponse>("join-room", req);
}

export function addCpuPlayer(req: AddCpuPlayerRequest) {
  return invoke<JoinLikeResponse>("add-cpu-player", req);
}

export function startRound(req: SeatAuthRequest) {
  return invoke<ActionLikeResponse>("start-round", req);
}

export function applyAction(req: ApplyActionRequest) {
  return invoke<ActionLikeResponse>("apply-action", req);
}

export function getMyView(req: GetMyViewRequest) {
  return invoke<ActionLikeResponse>("get-my-view", req);
}
