import { useState } from "react";
import type { GameState, RoundSummaryRow } from "../engine/types";
import { cardLabel, cardValue, isPlayable } from "../engine/deck";
import {
  applyDraw,
  applyFold,
  applyPass,
  applyPlay,
  applyReserve,
  checkGameOverPlayer,
  chipScore,
  initPlayers,
  legalActions,
  startRoundState,
} from "../engine/rules";
import Card from "../components/Card";
import PlayerBadge from "../components/PlayerBadge";

type Screen = "setup" | "transition" | "play" | "roundEnd" | "gameOver";

interface HotseatGameProps {
  onExit: () => void;
}

export default function HotseatGame({ onExit }: HotseatGameProps) {
  const [screen, setScreen] = useState<Screen>("setup");
  const [numPlayers, setNumPlayers] = useState(4);
  const [penalty, setPenalty] = useState(2);
  const [gs, setGs] = useState<GameState | null>(null);
  const [roundNumber, setRoundNumber] = useState(1);
  const [log, setLog] = useState<string[]>([]);
  const [summary, setSummary] = useState<RoundSummaryRow[] | null>(null);
  const [winner, setWinner] = useState<{ id: number; name: string } | null>(null);

  function pushLog(msg: string) {
    setLog((l) => [msg, ...l].slice(0, 30));
  }

  function handleStart() {
    const ps = initPlayers(numPlayers);
    const g = startRoundState(ps, 0, penalty);
    setGs(g);
    setRoundNumber(1);
    setLog([]);
    setSummary(null);
    setWinner(null);
    setScreen("transition");
  }

  function afterAction(newGs: GameState, msg: string) {
    pushLog(msg);
    if (newGs.roundOver) {
      const sum: RoundSummaryRow[] = newGs.players.map((p) => ({
        id: p.id,
        name: p.name,
        handLoss: newGs.roundResult!.handLossMap[p.id],
        total: chipScore(p.chips),
        wentOut: p.id === newGs.roundResult!.outPlayerId,
        wasReserved: newGs.roundResult!.reservedPlayerId === p.id,
      }));
      setSummary(sum);
      setGs(newGs);
      const w = checkGameOverPlayer(newGs.players);
      if (w) {
        setWinner(w);
        setScreen("gameOver");
      } else {
        setScreen("roundEnd");
      }
    } else {
      setGs(newGs);
      setScreen("transition");
    }
  }

  function startNextRound() {
    if (!gs || !summary) return;
    const wentOutIdx = summary.findIndex((s) => s.wentOut);
    const startIdx = wentOutIdx >= 0 ? wentOutIdx : 0;
    const g = startRoundState(gs.players, startIdx, penalty);
    setGs(g);
    setRoundNumber((n) => n + 1);
    setScreen("transition");
  }

  if (screen === "setup") {
    return (
      <div className="min-h-[600px] text-vicuna-text-primary flex flex-col items-center justify-center gap-6">
        <button onClick={onExit} className="self-start text-vicuna-text-secondary text-sm">
          ← メニューに戻る
        </button>
        <h2 className="text-2xl font-bold">対人戦セットアップ</h2>
        <div className="bg-vicuna-panel/60 rounded-lg p-5 w-80 flex flex-col gap-4">
          <div>
            <div className="text-sm mb-2">人数（2〜6人）</div>
            <div className="flex gap-2">
              {[2, 3, 4, 5, 6].map((n) => (
                <button
                  key={n}
                  onClick={() => setNumPlayers(n)}
                  className={[
                    "w-10 h-10 rounded-full border-2 font-bold",
                    numPlayers === n
                      ? "bg-vicuna-accent border-vicuna-accent-light text-vicuna-accent-ink"
                      : "border-vicuna-panel-border text-vicuna-text-secondary",
                  ].join(" ")}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>
          <div>
            <div className="text-sm mb-2">予約失敗ペナルティ</div>
            <div className="flex gap-2">
              {[2, 5, 10].map((v) => (
                <button
                  key={v}
                  onClick={() => setPenalty(v)}
                  className={[
                    "px-3 py-1 rounded border-2 text-sm font-bold",
                    penalty === v
                      ? "bg-vicuna-risk border-vicuna-risk-light text-white"
                      : "border-vicuna-panel-border text-vicuna-text-secondary",
                  ].join(" ")}
                >
                  +{v}
                </button>
              ))}
            </div>
          </div>
        </div>
        <button
          onClick={handleStart}
          className="px-6 py-3 bg-vicuna-accent text-vicuna-accent-ink font-bold rounded-lg hover:bg-vicuna-accent-light"
        >
          ゲーム開始
        </button>
      </div>
    );
  }

  if (screen === "transition" && gs) {
    const p = gs.players[gs.currentPlayerIdx];
    return (
      <div className="min-h-[600px] bg-vicuna-bg text-vicuna-text-primary rounded-xl p-8 flex flex-col items-center justify-center gap-4">
        <div className="text-vicuna-text-secondary text-sm">ラウンド {roundNumber}</div>
        <div className="text-2xl font-bold">{p.name} の手番</div>
        <p className="text-vicuna-text-muted text-sm text-center max-w-xs">
          デバイスを {p.name} に渡してからタップしてください。他の人は画面を見ないこと。
        </p>
        <button
          onClick={() => setScreen("play")}
          className="px-6 py-3 bg-vicuna-accent text-vicuna-accent-ink font-bold rounded-lg hover:bg-vicuna-accent-light"
        >
          手札を見る
        </button>
      </div>
    );
  }

  if (screen === "play" && gs) {
    const p = gs.players[gs.currentPlayerIdx];
    const { canDraw, canFold, canReserve, canPass, solo, isReserved, top } = legalActions(gs);

    return (
      <div className="min-h-[600px] text-vicuna-text-primary flex flex-col gap-4">
        <div className="flex gap-2 overflow-x-auto pb-2">
          {gs.players.map((pp, i) => (
            <PlayerBadge
              key={pp.id}
              pp={pp}
              isCurrent={i === gs.currentPlayerIdx}
              reservedPlayerId={gs.reservedPlayerId}
              revealHand={false}
            />
          ))}
        </div>

        <div className="mt-auto bg-vicuna-board rounded-xl p-4 flex flex-col gap-4">
          <div className="flex items-center justify-center gap-6">
            <div className="flex flex-col items-center gap-1">
              <div className="text-xs text-vicuna-text-secondary">山札</div>
              <div className="w-16 h-24 rounded-lg bg-vicuna-panel border-2 border-vicuna-panel-border flex items-center justify-center text-sm font-bold">
                {gs.deck.length}
              </div>
            </div>
            <div className="flex flex-col items-center gap-1">
              <div className="text-xs text-vicuna-text-secondary">場札</div>
              <Card token={top} disabled />
            </div>
          </div>

          <div>
            <div className="text-sm mb-2 flex items-center gap-2">
              {p.name} の手札
              {isReserved && (
                <span className="text-[10px] bg-vicuna-risk text-white rounded px-1">
                  予約中（降りられません）
                </span>
              )}
              {solo && (
                <span className="text-[10px] bg-vicuna-accent text-vicuna-accent-ink rounded px-1">
                  最後の1人（引けません）
                </span>
              )}
            </div>
            <div className="flex flex-wrap gap-2 mb-4">
              {p.hand
                .slice()
                .sort((a, b) => cardValue(a.token) - cardValue(b.token))
                .map((c) => (
                  <Card
                    key={c.id}
                    token={c.token}
                    disabled={!isPlayable(c.token, top)}
                    onClick={() =>
                      afterAction(applyPlay(gs, c.id), `${p.name} が ${cardLabel(c.token)} を出した`)
                    }
                  />
                ))}
            </div>

            <div className="flex gap-3 flex-wrap">
              <button
                onClick={() => afterAction(applyDraw(gs), `${p.name} が山札から1枚引いた`)}
                disabled={!canDraw}
                className="px-4 py-2 rounded bg-vicuna-info disabled:bg-neutral-600 disabled:text-neutral-400 text-white font-bold"
              >
                山札から引く
              </button>
              <button
                onClick={() => afterAction(applyFold(gs), `${p.name} がラウンドを降りた`)}
                disabled={!canFold}
                className="px-4 py-2 rounded bg-neutral-700 disabled:bg-neutral-600 disabled:text-neutral-400 text-white font-bold"
              >
                降りる
              </button>
              {canReserve && (
                <button
                  onClick={() => {
                    setGs(applyReserve(gs));
                    pushLog(`${p.name} が予約を宣言した（このラウンドは降りられません）`);
                  }}
                  className="px-4 py-2 rounded bg-vicuna-risk text-white font-bold"
                >
                  予約する（一発逆転）
                </button>
              )}
              {canPass && (
                <button
                  onClick={() => afterAction(applyPass(gs), `${p.name} は行動できずパスした`)}
                  className="px-4 py-2 rounded bg-neutral-500 text-white font-bold"
                >
                  パス（他に選択肢なし）
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="text-[10px] text-vicuna-text-secondary max-h-16 overflow-y-auto border-t border-vicuna-panel-border pt-2">
          {log.map((l, i) => (
            <div key={i}>{l}</div>
          ))}
        </div>
      </div>
    );
  }

  if (screen === "roundEnd" && summary) {
    return (
      <div className="min-h-[600px] text-vicuna-text-primary flex flex-col gap-4">
        <h2 className="text-2xl font-bold">ラウンド {roundNumber} 終了</h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-vicuna-text-secondary text-left">
              <th className="py-1">プレイヤー</th>
              <th>手札失点</th>
              <th>予約</th>
              <th>合計</th>
            </tr>
          </thead>
          <tbody>
            {summary.map((s) => (
              <tr key={s.id} className="border-t border-vicuna-panel-border">
                <td className="py-2">
                  {s.name}
                  {s.wentOut && (
                    <span className="ml-1 text-[10px] bg-vicuna-accent text-vicuna-accent-ink rounded px-1">
                      出し切り
                    </span>
                  )}
                </td>
                <td>{s.handLoss === 0 ? "-" : `-${s.handLoss}`}</td>
                <td>
                  {s.wasReserved ? (s.wentOut ? "成功（2枚返却）" : `失敗（+${penalty}）`) : "-"}
                </td>
                <td className="font-bold text-vicuna-accent-light">-{s.total}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <button
          onClick={startNextRound}
          className="mt-4 px-6 py-3 bg-vicuna-accent text-vicuna-accent-ink font-bold rounded-lg hover:bg-vicuna-accent-light self-start"
        >
          次のラウンドへ
        </button>
      </div>
    );
  }

  if (screen === "gameOver" && winner && gs) {
    return (
      <div className="min-h-[600px] text-vicuna-text-primary flex flex-col items-center justify-center gap-4">
        <div className="text-vicuna-accent text-sm">ゲーム終了</div>
        <div className="text-3xl font-bold">{winner.name} の勝利！</div>
        <table className="mt-4 text-sm">
          <tbody>
            {[...gs.players]
              .sort((a, b) => chipScore(a.chips) - chipScore(b.chips))
              .map((p) => (
                <tr key={p.id}>
                  <td className="pr-4 py-1">{p.name}</td>
                  <td className="text-vicuna-accent-light">-{chipScore(p.chips)}点</td>
                </tr>
              ))}
          </tbody>
        </table>
        <div className="flex gap-3 mt-4">
          <button
            onClick={() => setScreen("setup")}
            className="px-6 py-3 bg-vicuna-accent text-vicuna-accent-ink font-bold rounded-lg"
          >
            設定からやり直す
          </button>
          <button onClick={onExit} className="px-6 py-3 bg-neutral-700 text-white rounded-lg">
            メニューに戻る
          </button>
        </div>
      </div>
    );
  }
  return null;
}
