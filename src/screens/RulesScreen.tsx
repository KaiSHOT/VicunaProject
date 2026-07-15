import RulesContent from "../components/RulesContent";

interface RulesScreenProps {
  onExit: () => void;
}

export default function RulesScreen({ onExit }: RulesScreenProps) {
  return (
    <div className="min-h-[600px] text-vicuna-text-primary flex flex-col gap-4">
      <div className="flex justify-between items-center">
        <button onClick={onExit} className="text-vicuna-text-secondary text-sm">
          ← メニューに戻る
        </button>
        <h2 className="text-xl font-bold">遊び方・ルール</h2>
        <span className="w-20" />
      </div>
      <div className="max-w-2xl mx-auto w-full">
        <RulesContent />
      </div>
    </div>
  );
}
