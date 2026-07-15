import RulesContent from "./RulesContent";

interface RulesModalProps {
  open: boolean;
  onClose: () => void;
}

export default function RulesModal({ open, onClose }: RulesModalProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} aria-hidden="true" />
      <div className="relative bg-vicuna-panel border border-vicuna-panel-border rounded-xl p-5 w-full max-w-lg max-h-[80vh] overflow-y-auto text-vicuna-text-primary">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-bold">遊び方・ルール</h2>
          <button
            onClick={onClose}
            className="px-3 py-1 rounded bg-vicuna-panel-border text-vicuna-text-primary text-sm font-bold hover:bg-vicuna-accent hover:text-vicuna-accent-ink"
          >
            閉じる
          </button>
        </div>
        <RulesContent />
      </div>
    </div>
  );
}
