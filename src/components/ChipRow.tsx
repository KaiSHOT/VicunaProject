interface ChipRowProps {
  chips: number[];
}

export default function ChipRow({ chips }: ChipRowProps) {
  const black = chips.filter((c) => c === 10).length;
  const white = chips.filter((c) => c === 1).length;

  if (black === 0 && white === 0) {
    return <span className="text-xs text-vicuna-text-secondary">なし</span>;
  }

  return (
    <div className="flex gap-3 text-xs font-bold">
      {black > 0 && (
        <span className="flex items-center gap-1 text-vicuna-text-primary">
          <span
            aria-hidden="true"
            className="inline-block w-2.5 h-2.5 rounded-full bg-neutral-900 border border-vicuna-text-secondary/50"
          />
          ×{black}
        </span>
      )}
      {white > 0 && (
        <span className="flex items-center gap-1 text-vicuna-text-primary">
          <span
            aria-hidden="true"
            className="inline-block w-2.5 h-2.5 rounded-full bg-vicuna-cream border border-vicuna-cream-border"
          />
          ×{white}
        </span>
      )}
    </div>
  );
}
