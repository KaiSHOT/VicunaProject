import type { Token } from "../engine/types";
import card1 from "../assets/cards/card-1.svg";
import card2 from "../assets/cards/card-2.svg";
import card3 from "../assets/cards/card-3.svg";
import card4 from "../assets/cards/card-4.svg";
import card5 from "../assets/cards/card-5.svg";
import card6 from "../assets/cards/card-6.svg";
import cardVicuna from "../assets/cards/card-vicuna.svg";

// トークン→カードイラストのマッピング。
// 差し替え時はこのマップだけを更新すればよい（Card.tsx側の変更は不要）。
const CARD_ART: Record<Token, string> = {
  1: card1,
  2: card2,
  3: card3,
  4: card4,
  5: card5,
  6: card6,
  VICUNA: cardVicuna,
};

export function cardImage(token: Token): string {
  return CARD_ART[token];
}
