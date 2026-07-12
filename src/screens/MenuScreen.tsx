export type AppMode = "menu" | "hotseat" | "cvcWatch" | "cvcStats";

interface MenuScreenProps {
  onSelect: (mode: AppMode) => void;
}

export default function MenuScreen({ onSelect }: MenuScreenProps) {
  return (
    <div className="min-h-[600px] flex flex-col items-center justify-center gap-6 text-vicuna-text-primary">
      <h1 className="text-3xl font-bold tracking-wide">ビクーニャ + 予約制リスク</h1>
      <p className="text-vicuna-text-secondary text-sm">モードを選んでください</p>
      <div className="flex flex-col gap-3 w-72">
        <button
          onClick={() => onSelect("hotseat")}
          className="px-5 py-3 bg-vicuna-accent text-vicuna-accent-ink font-bold rounded-lg hover:bg-vicuna-accent-light"
        >
          対人戦（ホットシート）
        </button>
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
      </div>
    </div>
  );
}
