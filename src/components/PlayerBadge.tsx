import type { Player } from "../engine/types";
import { cardLabel, cardValue } from "../engine/deck";
import { chipScore } from "../engine/rules";
import { PLAYER_COLORS } from "./constants";
import ChipRow from "./ChipRow";

interface PlayerBadgeProps {
  pp: Player;
  isCurrent: boolean;
  reservedPlayerId: number | null;
  revealHand: boolean;
}

export default function PlayerBadge({
  pp,
  isCurrent,
  reservedPlayerId,
  revealHand,
}: PlayerBadgeProps) {
  return (
    <div
      className={[
        "flex-shrink-0 rounded-lg border-2 px-3 py-2 bg-vicuna-panel/60 min-w-[120px]",
        PLAYER_COLORS[pp.id % PLAYER_COLORS.length],
        isCurrent ? "ring-2 ring-white" : "",
        pp.folded ? "opacity-40" : "",
      ].join(" ")}
    >
      <div className="text-xs font-bold flex items-center gap-1">
        {pp.name}
        {pp.isAi && <span className="text-[10px] bg-vicuna-info-dark rounded px-1">AI</span>}
        {reservedPlayerId === pp.id && (
          <span className="text-[10px] bg-vicuna-risk text-white rounded px-1">予約中</span>
        )}
        {pp.folded && <span className="text-[10px] bg-neutral-600 rounded px-1">降り</span>}
      </div>
      <div className="text-[10px] text-vicuna-text-secondary">手札 {pp.hand.length}枚</div>
      {revealHand && (
        <div className="flex flex-wrap gap-1 my-1">
          {pp.hand
            .slice()
            .sort((a, b) => cardValue(a.token) - cardValue(b.token))
            .map((c) => (
              <span
                key={c.id}
                className={[
                  "text-[10px] px-1 rounded border",
                  c.token === "VICUNA"
                    ? "bg-vicuna-blush border-vicuna-blush-border text-vicuna-risk-ink"
                    : "bg-vicuna-cream border-vicuna-cream-border text-vicuna-accent-ink",
                ].join(" ")}
              >
                {cardLabel(c.token)}
              </span>
            ))}
        </div>
      )}
      <ChipRow chips={pp.chips} />
      <div className="text-[10px] text-vicuna-accent-light">{chipScore(pp.chips)}点</div>
    </div>
  );
}
