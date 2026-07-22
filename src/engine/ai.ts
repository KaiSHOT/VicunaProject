import type { AiMode, Decision, GameState, Player } from "./types.ts";
import { cardLabel, cardValue } from "./deck.ts";
import {
  applyDraw,
  applyFold,
  applyPass,
  applyPlay,
  applyReserve,
  chipScore,
  legalActions,
} from "./rules.ts";
import { randomFloat } from "./rng.ts";

// =====================================================
// AIロジック
// =====================================================

// naiveモード: 状況を一切見ず固定確率で予約する比較用ベースライン
export const NAIVE_RESERVE_PROB = 0.2;

export function decideAiAction(gs: GameState, aiMode: AiMode = "smart"): Decision {
  const { canPlay, canDraw, canFold, canReserve, canPass } = legalActions(gs);
  const p = gs.players[gs.currentPlayerIdx];

  if (canReserve) {
    if (aiMode === "naive") {
      // 手札の質・黒チップ・ペナルティを一切見ない固定確率ベースライン
      if (randomFloat() < NAIVE_RESERVE_PROB) {
        return { type: "reserve" };
      }
    } else {
      const myScore = chipScore(p.chips);
      const others = gs.players.filter((pp) => pp.id !== p.id);
      const avgOther =
        others.reduce((a, pp) => a + chipScore(pp.chips), 0) / others.length;
      const behind = myScore > avgOther;
      const blackCount = p.chips.filter((c) => c === 10).length;
      // 手札の質: 今出せる枚数の割合が高いほど「まだ余裕がある」とみなす
      const handQuality = canPlay.length / p.hand.length;
      // ペナルティが重いほど要求する手札の質が上がる（+2→0.26, +5→0.35, +10→0.5）
      const threshold = 0.2 + (gs.penalty / 10) * 0.3;
      if (behind && blackCount >= 2 && handQuality > threshold) {
        return { type: "reserve" };
      }
      if (behind && blackCount === 1 && handQuality > threshold && randomFloat() < 0.6) {
        return { type: "reserve" };
      }
    }
  }
  if (canPass) return { type: "pass" };
  if (canPlay.length > 0) {
    const valueCounts: Record<string, number> = {};
    p.hand.forEach((c) => {
      valueCounts[c.token] = (valueCounts[c.token] || 0) + 1;
    });
    const scored = canPlay.map((c) => {
      const isUnique = valueCounts[c.token] === 1;
      return { c, score: (isUnique ? 100 : 0) + cardValue(c.token) };
    });
    scored.sort((a, b) => b.score - a.score);
    return { type: "play", cardId: scored[0].c.id };
  }
  if (canDraw) {
    const drawProb = Math.max(0.15, 1 - p.hand.length * 0.09);
    if (randomFloat() < drawProb || !canFold) return { type: "draw" };
  }
  if (canFold) return { type: "fold" };
  return { type: "pass" };
}

export function applyDecision(gs: GameState, decision: Decision): GameState {
  switch (decision.type) {
    case "play":
      return applyPlay(gs, decision.cardId);
    case "draw":
      return applyDraw(gs);
    case "fold":
      return applyFold(gs);
    case "pass":
      return applyPass(gs);
    default:
      return applyPass(gs);
  }
}

export function describeDecision(
  player: Player,
  _gs: GameState,
  decision: Decision
): string {
  if (decision.type === "play") {
    const card = player.hand.find((c) => c.id === decision.cardId)!;
    return `${player.name} が ${cardLabel(card.token)} を出した`;
  }
  if (decision.type === "draw") return `${player.name} が山札から1枚引いた`;
  if (decision.type === "fold") return `${player.name} がラウンドを降りた`;
  return `${player.name} は行動できず投了した`;
}

// 1手（予約宣言があれば続けて実際のアクションまで）進め、ログ文字列を返す
export function runAiTurn(
  gs: GameState,
  aiMode: AiMode = "smart"
): { gs: GameState; logs: string[] } {
  const p0 = gs.players[gs.currentPlayerIdx];
  let cur = gs;
  const logs: string[] = [];
  const first = decideAiAction(cur, aiMode);
  if (first.type === "reserve") {
    cur = applyReserve(cur);
    logs.push(`${p0.name} が予約を宣言した（このラウンドは降りられない）`);
    const second = decideAiAction(cur, aiMode);
    logs.push(describeDecision(p0, cur, second));
    cur = applyDecision(cur, second);
    return { gs: cur, logs };
  }
  logs.push(describeDecision(p0, cur, first));
  cur = applyDecision(cur, first);
  return { gs: cur, logs };
}
