// =====================================================
// 型定義（人間戦・CvC観戦・CvC統計シミュレーションで共用）
// =====================================================

export type NumberToken = 1 | 2 | 3 | 4 | 5 | 6;
export type Token = NumberToken | "VICUNA";

export interface CardT {
  id: number;
  token: Token;
}

export interface Player {
  id: number;
  name: string;
  isAi: boolean;
  hand: CardT[];
  chips: number[];
  folded: boolean;
  hasGoneOut: boolean;
}

export interface RoundResult {
  outPlayerId: number | null;
  reservedPlayerId: number | null;
  handLossMap: Record<number, number>;
}

// 物理チップ銀行。黒（10点相当）は20枚上限で共有、白（1点相当）は無制限のため枚数管理不要。
export interface Bank {
  black: number;
}

export interface GameState {
  deck: CardT[];
  discard: CardT[];
  players: Player[];
  currentPlayerIdx: number;
  reservedPlayerId: number | null;
  firstTurnDone: Record<number, boolean>;
  roundOver: boolean;
  roundResult: RoundResult | null;
  penalty: number;
  bank: Bank;
}

export interface LegalActions {
  canPlay: CardT[];
  canDraw: boolean;
  canFold: boolean;
  canReserve: boolean;
  canPass: boolean;
  solo: boolean;
  isReserved: boolean;
  top: Token;
}

export type Decision =
  | { type: "play"; cardId: number }
  | { type: "draw" }
  | { type: "fold" }
  | { type: "pass" }
  | { type: "reserve" };

export type AiMode = "smart" | "naive";

export interface RoundSummaryRow {
  id: number;
  name: string;
  handLoss: number;
  total: number;
  wentOut: boolean;
  wasReserved: boolean;
}

export interface SingleGameResult {
  winnerId: number;
  rounds: number;
  reserveDeclared: number;
  reserveSuccess: number;
  finalScores: { id: number; score: number }[];
  reserveSuccessWinCount: number;
  reserveSuccessEventCount: number;
}

export interface BatchResult {
  aiMode: AiMode;
  penalty: number;
  n: number;
  winRates: number[];
  avgRounds: number;
  reserveDeclareRate: number;
  reserveSuccessRate: number | null;
  reserveSuccessWinRate: number | null;
  avgFinalScores: number[];
}
