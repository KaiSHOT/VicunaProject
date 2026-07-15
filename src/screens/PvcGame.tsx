import { useEffect, useState } from "react";
import type { GameState, Player, RoundSummaryRow } from "../engine/types";
import { cardLabel, cardValue, isPlayable } from "../engine/deck";
import {
  applyDraw,
  applyFold,
  applyPass,
  applyPlay,
  applyReserve,
  checkGameOverPlayer,
  chipScore,
  createBank,
  initPlayers,
  legalActions,
  startRoundState,
} from "../engine/rules";
import { runAiTurn } from "../engine/ai";
import Card from "../components/Card";
import PlayerBadge from "../components/PlayerBadge";
import RulesModal from "../components/RulesModal";

const PENALTY = 5;
const HUMAN_ID = 0;

// リロードしても対AI戦の盤面を維持するためのsessionStorageキー。
// GameStateの形（bank追加等）を変える際は末尾のバージョンを上げて、古い保存データを無効化する。
const STORAGE_KEY = "vicuna_pvc_state_v1";

type Screen = "setup" | "playing" | "roundEnd" | "gameOver";

interface PersistedPvcState {
  screen: Screen;
  aiCount: number;
  gs: GameState | null;
  roundNumber: number;
  log: string[];
  summary: RoundSummaryRow[] | null;
  winner: Player | null;
}

function loadPersisted(): PersistedPvcState | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      typeof parsed.screen !== "string" ||
      typeof parsed.roundNumber !== "number" ||
      typeof parsed.aiCount !== "number"
    ) {
      return null;
    }
    return parsed as PersistedPvcState;
  } catch {
    return null;
  }
}

function clearPersisted() {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // 保存領域にアクセスできなくても致命的ではないため無視
  }
}

interface PvcGameProps {
  onExit: () => void;
}

export default function PvcGame({ onExit }: PvcGameProps) {
  const [screen, setScreen] = useState<Screen>(() => loadPersisted()?.screen ?? "setup");
  const [aiCount, setAiCount] = useState<number>(() => loadPersisted()?.aiCount ?? 3);
  const [gs, setGs] = useState<GameState | null>(() => loadPersisted()?.gs ?? null);
  const [roundNumber, setRoundNumber] = useState<number>(
    () => loadPersisted()?.roundNumber ?? 1
  );
  const [log, setLog] = useState<string[]>(() => loadPersisted()?.log ?? []);
  const [summary, setSummary] = useState<RoundSummaryRow[] | null>(
    () => loadPersisted()?.summary ?? null
  );
  const [winner, setWinner] = useState<Player | null>(() => loadPersisted()?.winner ?? null);
  const [showRules, setShowRules] = useState(false);

  // 状態が変わるたびにsessionStorageへ保存し、タブを閉じるまでリロードしても盤面を維持する。
  useEffect(() => {
    const state: PersistedPvcState = { screen, aiCount, gs, roundNumber, log, summary, winner };
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // 保存に失敗しても致命的ではないため無視
    }
  }, [screen, aiCount, gs, roundNumber, log, summary, winner]);

  // メニューに戻るときは保存内容を破棄する（TOPからは常に新規セットアップになる）
  function handleExit() {
    clearPersisted();
    onExit();
  }

  function pushLogs(msgs: string[]) {
    setLog((l) => [...msgs.slice().reverse(), ...l].slice(0, 30));
  }

  function handleStart() {
    const numPlayers = aiCount + 1;
    const aiFlags = Array.from({ length: numPlayers }, (_, i) => i !== HUMAN_ID);
    const ps = initPlayers(numPlayers, aiFlags).map((p) =>
      p.id === HUMAN_ID ? { ...p, name: "あなた" } : p
    );
    const g = startRoundState(ps, 0, PENALTY, createBank());
    setGs(g);
    setRoundNumber(1);
    setLog([]);
    setSummary(null);
    setWinner(null);
    setScreen("playing");
  }

  function finishRound(newGs: GameState) {
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
  }

  function afterHumanAction(newGs: GameState, msg: string) {
    pushLogs([msg]);
    if (newGs.roundOver) {
      finishRound(newGs);
    } else {
      setGs(newGs);
    }
  }

  function startNextRound() {
    if (!gs || !summary) return;
    const wentOutIdx = summary.findIndex((s) => s.wentOut);
    const startIdx = wentOutIdx >= 0 ? wentOutIdx : 0;
    const g = startRoundState(gs.players, startIdx, PENALTY, gs.bank);
    setGs(g);
    setRoundNumber((n) => n + 1);
    setScreen("playing");
  }

  // 人間の手番以外は自動でAIのターンを進行する
  useEffect(() => {
    if (screen !== "playing" || !gs || gs.roundOver) return;
    const current = gs.players[gs.currentPlayerIdx];
    if (!current.isAi) return;
    const timer = setTimeout(() => {
      const { gs: ngs, logs } = runAiTurn(gs);
      pushLogs(logs);
      if (ngs.roundOver) {
        finishRound(ngs);
      } else {
        setGs(ngs);
      }
    }, 700);
    return () => clearTimeout(timer);
  }, [gs, screen]);

  const rulesModal = <RulesModal open={showRules} onClose={() => setShowRules(false)} />;

  if (screen === "setup") {
    return (
      <div className="min-h-[600px] text-vicuna-text-primary flex flex-col items-center justify-center gap-6">
        <div className="w-full flex justify-between items-center">
          <button onClick={handleExit} className="text-vicuna-text-secondary text-sm">
            ← メニューに戻る
          </button>
          <button
            onClick={() => setShowRules(true)}
            className="w-7 h-7 rounded-full border border-vicuna-text-secondary text-vicuna-text-secondary text-sm font-bold hover:bg-vicuna-panel/60"
          >
            ？
          </button>
        </div>
        <h2 className="text-2xl font-bold">対AI戦セットアップ</h2>
        <div className="bg-vicuna-panel/60 rounded-lg p-5 w-80 flex flex-col gap-4">
          <div>
            <div className="text-sm mb-2">AI人数（1〜5人）</div>
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  onClick={() => setAiCount(n)}
                  className={[
                    "w-10 h-10 rounded-full border-2 font-bold",
                    aiCount === n
                      ? "bg-vicuna-accent border-vicuna-accent-light text-vicuna-accent-ink"
                      : "border-vicuna-panel-border text-vicuna-text-secondary",
                  ].join(" ")}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>
          <div className="text-sm text-vicuna-text-secondary">
            予約失敗ペナルティ: +{PENALTY}（固定）
          </div>
        </div>
        <button
          onClick={handleStart}
          className="px-6 py-3 bg-vicuna-accent text-vicuna-accent-ink font-bold rounded-lg hover:bg-vicuna-accent-light"
        >
          ゲーム開始
        </button>
        {rulesModal}
      </div>
    );
  }

  if (screen === "playing" && gs) {
    const p = gs.players[gs.currentPlayerIdx];
    const isHumanTurn = !p.isAi;
    const { canDraw, canFold, canReserve, canPass, solo, isReserved, top } = legalActions(gs);

    return (
      <div className="min-h-[600px] text-vicuna-text-primary flex flex-col gap-4">
        <div className="flex justify-between items-center">
          <button onClick={handleExit} className="text-vicuna-text-secondary text-sm">
            ← メニューに戻る
          </button>
          <div className="text-sm text-vicuna-text-secondary">ラウンド {roundNumber}</div>
          <button
            onClick={() => setShowRules(true)}
            className="w-7 h-7 rounded-full border border-vicuna-text-secondary text-vicuna-text-secondary text-sm font-bold hover:bg-vicuna-panel/60"
          >
            ？
          </button>
        </div>

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

        <div className="bg-vicuna-board rounded-xl p-4 flex flex-col gap-4">
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

          {!isHumanTurn && (
            <div className="text-sm text-center text-vicuna-text-secondary">
              {p.name}（AI）が考え中…
            </div>
          )}

          {isHumanTurn && (
            <div>
              <div className="text-sm mb-2 flex items-center gap-2">
                あなたの手札
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
                        afterHumanAction(
                          applyPlay(gs, c.id),
                          `あなたが ${cardLabel(c.token)} を出した`
                        )
                      }
                    />
                  ))}
              </div>

              <div className="flex gap-3 flex-wrap">
                <button
                  onClick={() => afterHumanAction(applyDraw(gs), "あなたが山札から1枚引いた")}
                  disabled={!canDraw}
                  className="px-4 py-2 rounded bg-vicuna-info disabled:bg-neutral-600 disabled:text-neutral-400 text-white font-bold"
                >
                  山札から引く
                </button>
                <button
                  onClick={() => afterHumanAction(applyFold(gs), "あなたがラウンドを降りた")}
                  disabled={!canFold}
                  className="px-4 py-2 rounded bg-neutral-700 disabled:bg-neutral-600 disabled:text-neutral-400 text-white font-bold"
                >
                  降りる
                </button>
                {canReserve && (
                  <button
                    onClick={() => {
                      setGs(applyReserve(gs));
                      pushLogs(["あなたが予約を宣言した（このラウンドは降りられません）"]);
                    }}
                    className="px-4 py-2 rounded bg-vicuna-risk text-white font-bold"
                  >
                    予約する（一発逆転）
                  </button>
                )}
                {canPass && (
                  <button
                    onClick={() => afterHumanAction(applyPass(gs), "あなたは行動できず投了した")}
                    className="px-4 py-2 rounded bg-neutral-500 text-white font-bold"
                  >
                    投了（他に選択肢なし）
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="text-[10px] text-vicuna-text-secondary max-h-16 overflow-y-auto border-t border-vicuna-panel-border pt-2">
          {log.map((l, i) => (
            <div key={i}>{l}</div>
          ))}
        </div>
        {rulesModal}
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
                  {s.wasReserved ? (s.wentOut ? "成功（2枚返却）" : `失敗（+${PENALTY}）`) : "-"}
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
        <div className="text-3xl font-bold">
          {winner.id === HUMAN_ID ? "あなたの勝利！" : `${winner.name} の勝利！`}
        </div>
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
          <button onClick={handleExit} className="px-6 py-3 bg-neutral-700 text-white rounded-lg">
            メニューに戻る
          </button>
        </div>
      </div>
    );
  }
  return null;
}
