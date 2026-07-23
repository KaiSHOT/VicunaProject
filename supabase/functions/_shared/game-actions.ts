import {
  applyDraw,
  applyFold,
  applyPass,
  applyPlay,
  applyReserve,
  legalActions,
} from "../../../src/engine/rules.ts";
import type { Decision, GameState } from "../../../src/engine/types.ts";

// 人間・CPUどちらの手番でも共通で使う、合法性検証込みの決定適用。
// apply-action（人間の手番）とcpu-turns（CPUの自動進行）の両方から呼ばれる。
export function applyValidatedDecision(gs: GameState, decision: Decision): GameState {
  const legal = legalActions(gs);
  switch (decision.type) {
    case "play":
      if (!legal.canPlay.some((c) => c.id === decision.cardId)) {
        throw new Error("そのカードは出せません");
      }
      return applyPlay(gs, decision.cardId);
    case "draw":
      if (!legal.canDraw) throw new Error("山札から引けません");
      return applyDraw(gs);
    case "fold":
      if (!legal.canFold) throw new Error("このラウンドは降りられません");
      return applyFold(gs);
    case "reserve":
      if (!legal.canReserve) throw new Error("予約は宣言できません");
      return applyReserve(gs);
    case "pass":
      if (!legal.canPass) throw new Error("パスできません");
      return applyPass(gs);
  }
}
