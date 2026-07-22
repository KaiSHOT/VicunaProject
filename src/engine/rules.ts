import type { Bank, CardT, GameState, LegalActions, Player } from "./types.ts";
import { cardValue, isPlayable, makeDeck, shuffle } from "./deck.ts";

// =====================================================
// ゲームルール・状態遷移（純粋関数）
// =====================================================

export const BLACK_BANK_SIZE = 20;

export function createBank(): Bank {
  return { black: BLACK_BANK_SIZE };
}

export function calcHandLoss(hand: CardT[]): number {
  const tokens = new Set(hand.map((c) => c.token));
  let sum = 0;
  tokens.forEach((t) => (sum += cardValue(t)));
  return sum;
}

// loss点分のチップを黒優先で付与する。銀行の黒が尽きた分は白（1点×10枚）で代用する。
export function addLossToChips(
  chips: number[],
  loss: number,
  bank: Bank
): { chips: number[]; bank: Bank } {
  const c = [...chips];
  let remain = loss;
  let black = bank.black;
  while (remain >= 10) {
    if (black > 0) {
      c.push(10);
      black -= 1;
    } else {
      for (let i = 0; i < 10; i++) c.push(1);
    }
    remain -= 10;
  }
  while (remain > 0) {
    c.push(1);
    remain -= 1;
  }
  return { chips: c, bank: { black } };
}

// 価値の高いチップからn枚を除去して銀行へ返却する（予約成功時の返却用）。
export function returnChips(
  chips: number[],
  n: number,
  bank: Bank
): { chips: number[]; bank: Bank } {
  const sorted = [...chips].sort((a, b) => b - a);
  const removed = sorted.slice(0, n);
  const remaining = sorted.slice(n);
  const blackReturned = removed.filter((v) => v === 10).length;
  return { chips: remaining, bank: { black: bank.black + blackReturned } };
}

export function chipScore(chips: number[]): number {
  return chips.reduce((a, b) => a + b, 0);
}

// ラウンド終了時、全員の増減が確定した後に1回だけ実行する両替パス。
// 累計失点（chipScore）が多い順に優先し、白10枚→黒1枚を銀行の黒が尽きるまで繰り返す。
export function runBankExchange(
  players: Player[],
  bank: Bank
): { players: Player[]; bank: Bank } {
  const order = players
    .map((p, idx) => ({ idx, score: chipScore(p.chips) }))
    .sort((a, b) => b.score - a.score);

  const newPlayers = players.map((p) => ({ ...p, chips: [...p.chips] }));
  let black = bank.black;

  for (const { idx } of order) {
    const chips = newPlayers[idx].chips;
    while (black > 0) {
      const whiteCount = chips.filter((v) => v === 1).length;
      if (whiteCount < 10) break;
      let removed = 0;
      for (let i = chips.length - 1; i >= 0 && removed < 10; i--) {
        if (chips[i] === 1) {
          chips.splice(i, 1);
          removed += 1;
        }
      }
      chips.push(10);
      black -= 1;
    }
  }

  return { players: newPlayers, bank: { black } };
}

export function initPlayers(n: number, aiFlags?: boolean[]): Player[] {
  return Array.from({ length: n }, (_, i) => ({
    id: i,
    name: `プレイヤー${i + 1}`,
    isAi: aiFlags ? aiFlags[i] : false,
    hand: [],
    chips: [],
    folded: false,
    hasGoneOut: false,
  }));
}

export function activePlayers(players: Player[]): Player[] {
  return players.filter((p) => !p.folded);
}

export function nextActiveIdx(players: Player[], fromIdx: number): number {
  const n = players.length;
  let i = fromIdx;
  for (let step = 0; step < n; step++) {
    i = (i + 1) % n;
    if (!players[i].folded) return i;
  }
  return fromIdx;
}

export function startRoundState(
  players: Player[],
  startIdx: number,
  penalty: number,
  bank: Bank
): GameState {
  const deck = shuffle(makeDeck());
  const newPlayers = players.map((p) => ({
    ...p,
    hand: [] as CardT[],
    folded: false,
    hasGoneOut: false,
  }));
  for (let i = 0; i < 6; i++) {
    for (const p of newPlayers) p.hand.push(deck.pop()!);
  }
  const firstDiscard = deck.pop()!;
  return {
    deck,
    discard: [firstDiscard],
    players: newPlayers,
    currentPlayerIdx: startIdx,
    reservedPlayerId: null,
    firstTurnDone: {},
    roundOver: false,
    roundResult: null,
    penalty,
    bank,
  };
}

export function getTopToken(gs: GameState) {
  return gs.discard[gs.discard.length - 1].token;
}

export function legalActions(gs: GameState): LegalActions {
  const p = gs.players[gs.currentPlayerIdx];
  const top = getTopToken(gs);
  const canPlay = p.hand.filter((c) => isPlayable(c.token, top));
  const solo = activePlayers(gs.players).length === 1;
  const isReserved = gs.reservedPlayerId === p.id;
  const canDraw = gs.deck.length > 0 && !solo;
  const canFold = !isReserved && !solo;
  const canReserve = gs.reservedPlayerId === null && !gs.firstTurnDone[p.id];
  const canPass = canPlay.length === 0 && !canDraw && !canFold;
  return { canPlay, canDraw, canFold, canReserve, canPass, solo, isReserved, top };
}

export function endRoundWithOut(gs: GameState, outPlayerId: number): GameState {
  const handLossMap: Record<number, number> = {};
  let bank = gs.bank;
  const newPlayers = gs.players.map((p) => {
    const loss = p.id === outPlayerId ? 0 : calcHandLoss(p.hand);
    handLossMap[p.id] = loss;
    if (p.id === outPlayerId) return p;
    const result = addLossToChips(p.chips, loss, bank);
    bank = result.bank;
    return { ...p, chips: result.chips };
  });
  const outIdx = newPlayers.findIndex((p) => p.id === outPlayerId);
  const isReserved = gs.reservedPlayerId === outPlayerId;
  const returnN = isReserved ? 2 : 1;
  const returned = returnChips(newPlayers[outIdx].chips, returnN, bank);
  bank = returned.bank;
  newPlayers[outIdx] = {
    ...newPlayers[outIdx],
    chips: returned.chips,
    hasGoneOut: true,
  };

  const exchanged = runBankExchange(newPlayers, bank);

  return {
    ...gs,
    players: exchanged.players,
    bank: exchanged.bank,
    roundOver: true,
    roundResult: { outPlayerId, reservedPlayerId: gs.reservedPlayerId, handLossMap },
  };
}

export function endRoundNoOut(gs: GameState): GameState {
  const handLossMap: Record<number, number> = {};
  let bank = gs.bank;
  const newPlayers = gs.players.map((p) => {
    const loss = calcHandLoss(p.hand);
    handLossMap[p.id] = loss;
    let chips = p.chips;
    const lossResult = addLossToChips(chips, loss, bank);
    chips = lossResult.chips;
    bank = lossResult.bank;
    if (gs.reservedPlayerId === p.id && loss > 0) {
      const penaltyResult = addLossToChips(chips, gs.penalty, bank);
      chips = penaltyResult.chips;
      bank = penaltyResult.bank;
    }
    return { ...p, chips };
  });

  const exchanged = runBankExchange(newPlayers, bank);

  return {
    ...gs,
    players: exchanged.players,
    bank: exchanged.bank,
    roundOver: true,
    roundResult: { outPlayerId: null, reservedPlayerId: gs.reservedPlayerId, handLossMap },
  };
}

export function advanceAfterAction(gs: GameState): GameState {
  const active = activePlayers(gs.players);
  if (active.length === 0) return endRoundNoOut(gs);
  if (active.length === 1) {
    const solo = active[0];
    const top = getTopToken(gs);
    const canPlaySomething = solo.hand.some((c) => isPlayable(c.token, top));
    if (!canPlaySomething) return endRoundNoOut(gs);
  }
  const nIdx = nextActiveIdx(gs.players, gs.currentPlayerIdx);
  return { ...gs, currentPlayerIdx: nIdx };
}

export function applyPlay(gs: GameState, cardId: number): GameState {
  const p = gs.players[gs.currentPlayerIdx];
  const card = p.hand.find((c) => c.id === cardId)!;
  const newHand = p.hand.filter((c) => c.id !== cardId);
  const newDiscard = [...gs.discard, card];
  const newPlayers = gs.players.map((pp) =>
    pp.id === p.id ? { ...pp, hand: newHand } : pp
  );
  const firstTurnDone = { ...gs.firstTurnDone, [p.id]: true };
  const ngs = { ...gs, players: newPlayers, discard: newDiscard, firstTurnDone };
  if (newHand.length === 0) return endRoundWithOut(ngs, p.id);
  return advanceAfterAction(ngs);
}

export function applyDraw(gs: GameState): GameState {
  const p = gs.players[gs.currentPlayerIdx];
  const deck = [...gs.deck];
  const drawn = deck.pop()!;
  const newPlayers = gs.players.map((pp) =>
    pp.id === p.id ? { ...pp, hand: [...pp.hand, drawn] } : pp
  );
  const firstTurnDone = { ...gs.firstTurnDone, [p.id]: true };
  const ngs = { ...gs, players: newPlayers, deck, firstTurnDone };
  return advanceAfterAction(ngs);
}

export function applyFold(gs: GameState): GameState {
  const p = gs.players[gs.currentPlayerIdx];
  const newPlayers = gs.players.map((pp) =>
    pp.id === p.id ? { ...pp, folded: true } : pp
  );
  const firstTurnDone = { ...gs.firstTurnDone, [p.id]: true };
  const ngs = { ...gs, players: newPlayers, firstTurnDone };
  return advanceAfterAction(ngs);
}

export function applyReserve(gs: GameState): GameState {
  const p = gs.players[gs.currentPlayerIdx];
  return { ...gs, reservedPlayerId: p.id };
}

export function applyPass(gs: GameState): GameState {
  const p = gs.players[gs.currentPlayerIdx];
  const firstTurnDone = { ...gs.firstTurnDone, [p.id]: true };
  return advanceAfterAction({ ...gs, firstTurnDone });
}

export function checkGameOverPlayer(players: Player[]): Player | null {
  const loser = players.find((p) => chipScore(p.chips) >= 40);
  if (!loser) return null;
  return [...players].sort((a, b) => chipScore(a.chips) - chipScore(b.chips))[0];
}
