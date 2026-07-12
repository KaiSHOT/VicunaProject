import type { Token } from "../engine/types";
import { cardLabel } from "../engine/deck";
import { cardImage } from "./cardArt";

interface CardProps {
  token: Token;
  onClick?: () => void;
  disabled?: boolean;
}

export default function Card({ token, onClick, disabled }: CardProps) {
  const isVicuna = token === "VICUNA";
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={cardLabel(token)}
      className={[
        "rounded-lg border-2 flex flex-col items-center justify-center gap-1 shadow-md transition-transform w-16 h-24",
        isVicuna
          ? "bg-vicuna-blush border-vicuna-blush-border text-vicuna-risk-ink"
          : "bg-vicuna-cream border-vicuna-cream-border text-vicuna-accent-ink",
        disabled ? "opacity-40 cursor-not-allowed" : "hover:-translate-y-1 cursor-pointer",
      ].join(" ")}
    >
      <img src={cardImage(token)} alt="" className="w-10 h-10" />
      {isVicuna && <span className="text-xs font-bold">{cardLabel(token)}</span>}
    </button>
  );
}
