import { useState } from "react";
import type { AiMode, BatchResult } from "../engine/types";
import { runSimulationBatch } from "../engine/simulation";

interface CvcStatsProps {
  onExit: () => void;
}

type AiCompareMode = AiMode | "both";

export default function CvcStats({ onExit }: CvcStatsProps) {
  const [numPlayers, setNumPlayers] = useState(3);
  const [n, setN] = useState(200);
  const [compareMode, setCompareMode] = useState(true);
  const [singlePenalty, setSinglePenalty] = useState(2);
  const [aiCompareMode, setAiCompareMode] = useState<AiCompareMode>("both");
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<BatchResult[] | null>(null);

  function runBatch() {
    setRunning(true);
    setResults(null);
    setTimeout(() => {
      const penalties = compareMode ? [2, 5, 10] : [singlePenalty];
      const aiModes: AiMode[] = aiCompareMode === "both" ? ["smart", "naive"] : [aiCompareMode];
      const res: BatchResult[] = [];
      for (const mode of aiModes) {
        for (const pen of penalties) {
          res.push(runSimulationBatch(numPlayers, pen, n, mode));
        }
      }
      setResults(res);
      setRunning(false);
    }, 30);
  }

  return (
    <div className="min-h-[600px] text-vicuna-text-primary flex flex-col gap-4">
      <button onClick={onExit} className="self-start text-vicuna-text-secondary text-sm">
        ← メニューに戻る
      </button>
      <h2 className="text-2xl font-bold">CvC 統計シミュレーション</h2>

      <div className="bg-vicuna-panel/60 rounded-lg p-5 flex flex-col gap-4 max-w-md">
        <div>
          <div className="text-sm mb-2">AI人数</div>
          <div className="flex gap-2">
            {[2, 3, 4, 5, 6].map((v) => (
              <button
                key={v}
                onClick={() => setNumPlayers(v)}
                className={[
                  "w-10 h-10 rounded-full border-2 font-bold",
                  numPlayers === v
                    ? "bg-vicuna-risk border-vicuna-risk-light text-white"
                    : "border-vicuna-panel-border text-vicuna-text-secondary",
                ].join(" ")}
              >
                {v}
              </button>
            ))}
          </div>
        </div>

        <div>
          <div className="text-sm mb-2">試合数</div>
          <div className="flex gap-2">
            {[50, 200, 1000].map((v) => (
              <button
                key={v}
                onClick={() => setN(v)}
                className={[
                  "px-3 py-1 rounded border-2 text-sm font-bold",
                  n === v
                    ? "bg-vicuna-risk border-vicuna-risk-light text-white"
                    : "border-vicuna-panel-border text-vicuna-text-secondary",
                ].join(" ")}
              >
                {v}
              </button>
            ))}
          </div>
        </div>

        <div>
          <div className="text-sm mb-2">AIロジック</div>
          <div className="flex gap-2 flex-wrap">
            {(
              [
                { v: "smart", label: "現行（手札の質で選別）" },
                { v: "naive", label: "単純（固定20%で予約）" },
                { v: "both", label: "両方比較" },
              ] as const
            ).map((opt) => (
              <button
                key={opt.v}
                onClick={() => setAiCompareMode(opt.v)}
                className={[
                  "px-3 py-1 rounded border-2 text-sm font-bold",
                  aiCompareMode === opt.v
                    ? "bg-vicuna-info border-vicuna-info-light text-white"
                    : "border-vicuna-panel-border text-vicuna-text-secondary",
                ].join(" ")}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={compareMode}
            onChange={(e) => setCompareMode(e.target.checked)}
          />
          ペナルティ +2 / +5 / +10 をまとめて比較する
        </label>

        {!compareMode && (
          <div>
            <div className="text-sm mb-2">ペナルティ値</div>
            <div className="flex gap-2">
              {[2, 5, 10].map((v) => (
                <button
                  key={v}
                  onClick={() => setSinglePenalty(v)}
                  className={[
                    "px-3 py-1 rounded border-2 text-sm font-bold",
                    singlePenalty === v
                      ? "bg-vicuna-risk border-vicuna-risk-light text-white"
                      : "border-vicuna-panel-border text-vicuna-text-secondary",
                  ].join(" ")}
                >
                  +{v}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <button
        onClick={runBatch}
        disabled={running}
        className="px-6 py-3 bg-vicuna-risk disabled:bg-neutral-600 text-white font-bold rounded-lg self-start"
      >
        {running ? "実行中..." : "シミュレーション実行"}
      </button>

      {results && (
        <div className="overflow-x-auto">
          <table className="text-sm border-collapse">
            <thead>
              <tr className="text-vicuna-text-secondary text-left">
                <th className="py-1 pr-4">AIロジック</th>
                <th className="pr-4">ペナルティ</th>
                <th className="pr-4">平均ラウンド数/試合</th>
                <th className="pr-4">予約宣言率（全ラウンド中）</th>
                <th className="pr-4">予約成功率</th>
                <th className="pr-4">予約成功者の最終勝率</th>
                {Array.from({ length: numPlayers }, (_, i) => (
                  <th key={i} className="pr-4">
                    P{i + 1} 勝率 / 平均失点
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {results.map((r) => (
                <tr key={`${r.aiMode}-${r.penalty}`} className="border-t border-vicuna-panel-border">
                  <td className="py-2 pr-4">
                    <span
                      className={[
                        "text-[10px] rounded px-1",
                        r.aiMode === "naive" ? "bg-neutral-600" : "bg-vicuna-info-dark",
                      ].join(" ")}
                    >
                      {r.aiMode === "naive" ? "単純" : "現行"}
                    </span>
                  </td>
                  <td className="pr-4 font-bold">+{r.penalty}</td>
                  <td className="pr-4">{r.avgRounds.toFixed(1)}</td>
                  <td className="pr-4">{r.reserveDeclareRate.toFixed(1)}%</td>
                  <td className="pr-4">
                    {r.reserveSuccessRate === null ? "-" : `${r.reserveSuccessRate.toFixed(1)}%`}
                  </td>
                  <td className="pr-4">
                    {r.reserveSuccessWinRate === null
                      ? "-"
                      : `${r.reserveSuccessWinRate.toFixed(1)}%`}
                  </td>
                  {r.winRates.map((wr, i) => (
                    <td key={i} className="pr-4">
                      {wr.toFixed(1)}% / -{r.avgFinalScores[i].toFixed(1)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          <p className="text-[11px] text-vicuna-text-secondary mt-3 max-w-lg">
            ※ 全員同一のAIロジックで対戦しているため、勝率の差は座席位置（先手/後手）や乱数の偏りを示す。
            「単純」は手札の質・黒チップ・ペナルティを無視し固定20%で予約するベースライン。
            「予約成功者の最終勝率」はランダムなら概ね 1/人数 に近づく想定（3人なら約33%）。
            現行と単純でこの値がどう違うかが、AIの選抜の効果とルール自体の効果を分ける手がかりになる。
          </p>
        </div>
      )}
    </div>
  );
}
