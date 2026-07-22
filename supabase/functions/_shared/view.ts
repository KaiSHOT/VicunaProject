import type { CardT, GameState, LegalActions, RoundResult, Token } from "../../../src/engine/types.ts";
import { legalActions } from "../../../src/engine/rules.ts";

export interface RoomRow {
  id: string;
  code: string;
  status: "lobby" | "playing" | "finished";
  max_players: number;
  penalty: number;
  round_no: number;
  turn_version: number;
  game_state: GameState | null;
  created_at: string;
  updated_at: string;
}

export interface PlayerRow {
  id: string;
  room_id: string;
  seat_idx: number;
  nickname: string;
  is_ai: boolean;
  is_connected: boolean;
  client_secret: string;
  joined_at: string;
}

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
  status: "lobby" | "playing" | "finished";
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

// 他プレイヤーの手札枚数のみを公開し、内容は一切含めない。
export function toPublicView(room: RoomRow, players: PlayerRow[]): PublicRoomView {
  const gs = room.game_state;
  const gsPlayers = gs?.players ?? [];

  const publicPlayers: PublicPlayerView[] = players
    .slice()
    .sort((a, b) => a.seat_idx - b.seat_idx)
    .map((p) => {
      const gp = gsPlayers.find((x) => x.id === p.seat_idx);
      return {
        seatIdx: p.seat_idx,
        nickname: p.nickname,
        isAi: p.is_ai,
        isConnected: p.is_connected,
        handCount: gp?.hand.length ?? 0,
        chips: gp?.chips ?? [],
        folded: gp?.folded ?? false,
        hasGoneOut: gp?.hasGoneOut ?? false,
      };
    });

  return {
    roomCode: room.code,
    status: room.status,
    maxPlayers: room.max_players,
    turnVersion: room.turn_version,
    roundNo: room.round_no,
    currentPlayerIdx: gs?.currentPlayerIdx ?? null,
    reservedPlayerId: gs?.reservedPlayerId ?? null,
    discardTop: gs ? gs.discard[gs.discard.length - 1]?.token ?? null : null,
    deckCount: gs?.deck.length ?? 0,
    bankBlack: gs?.bank.black ?? null,
    roundOver: gs?.roundOver ?? false,
    roundResult: gs?.roundResult ?? null,
    players: publicPlayers,
  };
}

// 呼び出し元のseat_idxに対応する手札のみを含む秘匿ビュー。
export function toPrivateView(gs: GameState | null, seatIdx: number): PrivateSeatView {
  if (!gs) return { seatIdx, hand: [], legalActions: null };
  const player = gs.players.find((p) => p.id === seatIdx);
  const isMyTurn = gs.currentPlayerIdx === seatIdx;
  return {
    seatIdx,
    hand: player?.hand ?? [],
    legalActions: isMyTurn && !gs.roundOver ? legalActions(gs) : null,
  };
}
