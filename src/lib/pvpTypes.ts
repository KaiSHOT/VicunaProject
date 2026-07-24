// supabase/functions/_shared/view.ts, validate.ts と型を同期させること（Denoの相対importの都合でここは複製）
import type { CardT, Decision, LegalActions, RoundResult, Token } from "../engine/types";

export type RoomStatus = "lobby" | "playing" | "finished";

export interface PublicPlayerView {
  seatIdx: number;
  nickname: string;
  isAi: boolean;
  isConnected: boolean;
  handCount: number;
  chips: number[];
  folded: boolean;
  hasGoneOut: boolean;
}

export interface PublicRoomView {
  roomCode: string;
  status: RoomStatus;
  maxPlayers: number;
  turnVersion: number;
  roundNo: number;
  currentPlayerIdx: number | null;
  reservedPlayerId: number | null;
  discardTop: Token | null;
  deckCount: number;
  bankBlack: number | null;
  roundOver: boolean;
  roundResult: RoundResult | null;
  players: PublicPlayerView[];
}

export interface PrivateSeatView {
  seatIdx: number;
  hand: CardT[];
  legalActions: LegalActions | null;
}

export interface CreateRoomRequest {
  nickname: string;
  maxPlayers: number;
  penalty: number;
}

export interface JoinRoomRequest {
  roomCode: string;
  nickname: string;
}

export interface AddCpuPlayerRequest {
  roomCode: string;
  nickname?: string;
}

export interface SeatAuthRequest {
  roomCode: string;
  seatIdx: number;
  clientSecret: string;
  expectedTurnVersion: number;
}

export interface ApplyActionRequest extends SeatAuthRequest {
  decision: Decision;
}

export interface GetMyViewRequest {
  roomCode: string;
  seatIdx: number;
  clientSecret: string;
}

export interface JoinLikeResponse {
  roomCode: string;
  seatIdx: number;
  clientSecret: string;
  public: PublicRoomView;
}

export interface ActionLikeResponse {
  public: PublicRoomView;
  private: PrivateSeatView;
}
