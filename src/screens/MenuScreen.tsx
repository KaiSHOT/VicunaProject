export type AppMode = "menu" | "pvc" | "pvp" | "cvcWatch" | "cvcStats" | "rules";

interface MenuScreenProps {
  onSelect: (mode: AppMode) => void;
}

export default function MenuScreen({ onSelect }: MenuScreenProps) {
  return (
    <div className="min-h-[600px] flex flex-col items-center justify-center gap-6 text-vicuna-text-primary">
      <h1 className="text-3xl font-bold tracking-wide">ビクーニャ</h1>
      <p className="text-vicuna-text-secondary text-sm">モードを選んでください</p>
      <div className="flex flex-col gap-3 w-72">
        <button
          onClick={() => onSelect("pvc")}
          className="px-5 py-3 bg-vicuna-accent text-vicuna-accent-ink font-bold rounded-lg hover:bg-vicuna-accent-light"
        >
          対AI戦
        </button>
        <button
          onClick={() => onSelect("pvp")}
          className="px-5 py-3 bg-vicuna-info-dark text-white font-bold rounded-lg hover:bg-vicuna-info"
        >
          友達と対戦（PvP）
        </button>
        {import.meta.env.DEV && (
          <>
            <button
              onClick={() => onSelect("cvcWatch")}
              className="px-5 py-3 bg-vicuna-info text-white font-bold rounded-lg hover:bg-vicuna-info-light"
            >
              CvC 観戦モード
            </button>
            <button
              onClick={() => onSelect("cvcStats")}
              className="px-5 py-3 bg-vicuna-risk text-white font-bold rounded-lg hover:bg-vicuna-risk-light"
            >
              CvC 統計シミュレーション
            </button>
          </>
        )}
        <button
          onClick={() => onSelect("rules")}
          className="px-5 py-3 bg-transparent border border-vicuna-text-secondary text-vicuna-text-secondary font-bold rounded-lg hover:bg-vicuna-panel/60"
        >
          遊び方・ルール
        </button>
      </div>
    </div>
  );
}
