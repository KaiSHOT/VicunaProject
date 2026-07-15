import type { AiMode, BatchResult, SingleGameResult } from "./types";
import { runAiTurn } from "./ai";
import { checkGameOverPlayer, chipScore, createBank, initPlayers, startRoundState } from "./rules";

// ---- ヘッドレスシミュレーション（統計モード用）----

export function simulateOneGame(
  numPlayers: number,
  penalty: number,
  aiMode: AiMode = "smart"
): SingleGameResult {
  let players = initPlayers(numPlayers, Array(numPlayers).fill(true));
  let startIdx = 0;
  let bank = createBank();
  let rounds = 0;
  let reserveDeclared = 0;
  let reserveSuccess = 0;
  const reserveSuccessPlayerIds: number[] = []; // 予約成功したプレイヤーIDの履歴（同一人物が複数回でも記録）

  while (true) {
    let gs = startRoundState(players, startIdx, penalty, bank);
    rounds += 1;
    let guard = 0;
    while (!gs.roundOver && guard < 2000) {
      const { gs: ngs } = runAiTurn(gs, aiMode);
      gs = ngs;
      guard += 1;
    }
    if (gs.reservedPlayerId !== null) {
      reserveDeclared += 1;
      if (gs.roundResult!.outPlayerId === gs.reservedPlayerId) {
        reserveSuccess += 1;
        reserveSuccessPlayerIds.push(gs.reservedPlayerId);
      }
    }
    players = gs.players;
    bank = gs.bank; // 銀行はゲーム内で引き継ぐ（ラウンドをまたいでリセットしない）
    const winner = checkGameOverPlayer(players);
    if (winner) {
      const finalScores = players.map((p) => ({ id: p.id, score: chipScore(p.chips) }));
      const reserveSuccessWinCount = reserveSuccessPlayerIds.filter(
        (id) => id === winner.id
      ).length;
      return {
        winnerId: winner.id,
        rounds,
        reserveDeclared,
        reserveSuccess,
        finalScores,
        reserveSuccessWinCount,
        reserveSuccessEventCount: reserveSuccessPlayerIds.length,
      };
    }
    startIdx =
      gs.roundResult!.outPlayerId !== null
        ? players.findIndex((p) => p.id === gs.roundResult!.outPlayerId)
        : 0;
  }
}

export function runSimulationBatch(
  numPlayers: number,
  penalty: number,
  n: number,
  aiMode: AiMode = "smart"
): BatchResult {
  const wins = Array(numPlayers).fill(0);
  let totalRounds = 0;
  let totalReserveDeclared = 0;
  let totalReserveSuccess = 0;
  let totalReserveSuccessWinCount = 0;
  let totalReserveSuccessEventCount = 0;
  const finalScoreSums = Array(numPlayers).fill(0);

  for (let i = 0; i < n; i++) {
    const r = simulateOneGame(numPlayers, penalty, aiMode);
    wins[r.winnerId] += 1;
    totalRounds += r.rounds;
    totalReserveDeclared += r.reserveDeclared;
    totalReserveSuccess += r.reserveSuccess;
    totalReserveSuccessWinCount += r.reserveSuccessWinCount;
    totalReserveSuccessEventCount += r.reserveSuccessEventCount;
    r.finalScores.forEach((s) => (finalScoreSums[s.id] += s.score));
  }

  return {
    aiMode,
    penalty,
    n,
    winRates: wins.map((w) => (w / n) * 100),
    avgRounds: totalRounds / n,
    reserveDeclareRate: (totalReserveDeclared / totalRounds) * 100,
    reserveSuccessRate:
      totalReserveDeclared > 0 ? (totalReserveSuccess / totalReserveDeclared) * 100 : null,
    // 予約成功イベントのうち、そのプレイヤーが最終的にゲームに勝った割合
    // 参考値: ランダムなら概ね (1/numPlayers)*100 に近づくはず
    reserveSuccessWinRate:
      totalReserveSuccessEventCount > 0
        ? (totalReserveSuccessWinCount / totalReserveSuccessEventCount) * 100
        : null,
    avgFinalScores: finalScoreSums.map((s) => s / n),
  };
}
