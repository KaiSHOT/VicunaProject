import { useRef, useState } from "react";
import type { GameState, Player } from "../engine/types";
import { runAiTurn } from "../engine/ai";
import { checkGameOverPlayer, getTopToken, initPlayers, startRoundState } from "../engine/rules";
import Card from "../components/Card";
import PlayerBadge from "../components/PlayerBadge";

interface CvcWatchProps {
  onExit: () => void;
}

export default function CvcWatch({ onExit }: CvcWatchProps) {
  const [numPlayers, setNumPlayers] = useState(3);
  const [penalty, setPenalty] = useState(2);
  const [gs, setGs] = useState<GameState | null>(null);
  const [roundNumber, setRoundNumber] = useState(1);
  const [log, setLog] = useState<string[]>([]);
  const [winner, setWinner] = useState<Player | null>(null);
  const [autoPlay, setAutoPlay] = useState(false);
  const [speed, setSpeed] = useState(600);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  function pushLogs(msgs: string[]) {
    setLog((l) => [...msgs.slice().reverse(), ...l].slice(0, 40));
  }

  function start() {
    const ps = initPlayers(numPlayers, Array(numPlayers).fill(true));
    setGs(startRoundState(ps, 0, penalty));
    setRoundNumber(1);
    setLog([]);
    setWinner(null);
  }

  function step() {
    setGs((cur) => {
      if (!cur) return cur;
      if (cur.roundOver) {
        const w = checkGameOverPlayer(cur.players);
        if (w) {
          setWinner(w);
          stopAuto();
          return cur;
        }
        const startIdx =
          cur.roundResult!.outPlayerId !== null
            ? cur.players.findIndex((p) => p.id === cur.roundResult!.outPlayerId)
            : 0;
        setRoundNumber((n) => n + 1);
        pushLogs([`--- ラウンド開始 ---`]);
        return startRoundState(cur.players, startIdx, penalty);
      }
      const { gs: ngs, logs } = runAiTurn(cur);
      pushLogs(logs);
      if (ngs.roundOver) pushLogs([`ラウンド終了`]);
      return ngs;
    });
  }

  function toggleAuto() {
    if (autoPlay) {
      stopAuto();
    } else {
      setAutoPlay(true);
      timerRef.current = setInterval(step, speed);
    }
  }
  function stopAuto() {
    setAutoPlay(false);
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }

  if (!gs) {
    return (
      <div className="min-h-[600px] text-vicuna-text-primary flex flex-col items-center justify-center gap-6">
        <button onClick={onExit} className="self-start text-vicuna-text-secondary text-sm">
          ← メニューに戻る
        </button>
        <h2 className="text-2xl font-bold">CvC 観戦セットアップ</h2>
        <div className="bg-vicuna-panel/60 rounded-lg p-5 w-80 flex flex-col gap-4">
          <div>
            <div className="text-sm mb-2">AI人数（2〜6人、既定3）</div>
            <div className="flex gap-2">
              {[2, 3, 4, 5, 6].map((n) => (
                <button
                  key={n}
                  onClick={() => setNumPlayers(n)}
                  className={[
                    "w-10 h-10 rounded-full border-2 font-bold",
                    numPlayers === n
                      ? "bg-vicuna-info border-vicuna-info-light text-white"
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
          onClick={start}
          className="px-6 py-3 bg-vicuna-info text-white font-bold rounded-lg hover:bg-vicuna-info-light"
        >
          観戦開始
        </button>
      </div>
    );
  }

  const top = getTopToken(gs);
  const cur = gs.players[gs.currentPlayerIdx];

  return (
    <div className="min-h-[600px] text-vicuna-text-primary flex flex-col gap-4">
      <div className="flex justify-between items-center">
        <button onClick={onExit} className="text-vicuna-text-secondary text-sm">
          ← メニューに戻る
        </button>
        <div className="text-sm text-vicuna-text-secondary">ラウンド {roundNumber}</div>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-2">
        {gs.players.map((pp, i) => (
          <PlayerBadge
            key={pp.id}
            pp={pp}
            isCurrent={i === gs.currentPlayerIdx}
            reservedPlayerId={gs.reservedPlayerId}
            revealHand={true}
          />
        ))}
      </div>

      <div className="bg-vicuna-board rounded-xl p-4 flex flex-col items-center gap-3">
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

        {!winner && (
          <div className="text-sm text-center text-vicuna-text-secondary">
            手番: <span className="font-bold text-vicuna-text-primary">{cur.name}</span>
            {gs.roundOver && "（このラウンドは終了、次のステップでラウンド開始）"}
          </div>
        )}
      </div>

      {winner && (
        <div className="text-center bg-vicuna-panel/60 rounded-lg p-4">
          <div className="text-vicuna-accent font-bold text-lg">
            {winner.name} の勝利！（ラウンド{roundNumber}まで）
          </div>
        </div>
      )}

      <div className="flex gap-3 justify-center flex-wrap">
        <button
          onClick={step}
          disabled={!!winner}
          className="px-4 py-2 rounded bg-vicuna-accent disabled:bg-neutral-600 disabled:text-neutral-400 text-vicuna-accent-ink font-bold"
        >
          1手進める
        </button>
        <button
          onClick={toggleAuto}
          disabled={!!winner}
          className="px-4 py-2 rounded bg-vicuna-info disabled:bg-neutral-600 text-white font-bold"
        >
          {autoPlay ? "自動再生を停止" : "自動再生"}
        </button>
        <select
          value={speed}
          onChange={(e) => {
            const v = Number(e.target.value);
            setSpeed(v);
            if (autoPlay && timerRef.current) {
              clearInterval(timerRef.current);
              timerRef.current = setInterval(step, v);
            }
          }}
          className="bg-vicuna-panel text-vicuna-text-primary rounded px-2 text-sm"
        >
          <option value={1200}>低速</option>
          <option value={600}>中速</option>
          <option value={150}>高速</option>
        </select>
        <button
          onClick={() => {
            stopAuto();
            setGs(null);
          }}
          className="px-4 py-2 rounded bg-neutral-700 text-white font-bold"
        >
          設定に戻る
        </button>
      </div>

      <div className="text-[11px] text-vicuna-text-secondary max-h-32 overflow-y-auto border-t border-vicuna-panel-border pt-2">
        {log.map((l, i) => (
          <div key={i}>{l}</div>
        ))}
      </div>
    </div>
  );
}
