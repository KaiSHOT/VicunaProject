interface ChipRowProps {
  chips: number[];
}

export default function ChipRow({ chips }: ChipRowProps) {
  const sorted = [...chips].sort((a, b) => b - a);
  return (
    <div className="flex flex-wrap gap-1">
      {sorted.map((c, i) =>
        c === 10 ? (
          <span
            key={i}
            className="w-5 h-5 rounded-full bg-neutral-900 border border-neutral-600 text-[9px] text-white flex items-center justify-center"
          >
            10
          </span>
        ) : (
          <span
            key={i}
            className="w-5 h-5 rounded-full bg-white border border-neutral-400 text-[9px] text-neutral-800 flex items-center justify-center"
          >
            1
          </span>
        )
      )}
      {chips.length === 0 && <span className="text-xs text-vicuna-text-secondary">なし</span>}
    </div>
  );
}
