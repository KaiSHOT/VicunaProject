import type { CardT, Token } from "./types.ts";
import { randomFloat } from "./rng.ts";

// =====================================================
// トークン・デッキ関連の純粋関数
// =====================================================

export const ORDER: Token[] = [1, 2, 3, 4, 5, 6, "VICUNA"];

export function nextToken(token: Token): Token {
  const idx = ORDER.indexOf(token);
  return ORDER[(idx + 1) % ORDER.length];
}

export function cardLabel(token: Token): string {
  return token === "VICUNA" ? "ビクーニャ" : String(token);
}

export function cardValue(token: Token): number {
  return token === "VICUNA" ? 10 : token;
}

export function makeDeck(): CardT[] {
  const deck: CardT[] = [];
  let id = 0;
  for (const v of [1, 2, 3, 4, 5, 6] as const) {
    for (let i = 0; i < 8; i++) deck.push({ id: id++, token: v });
  }
  for (let i = 0; i < 8; i++) deck.push({ id: id++, token: "VICUNA" });
  return deck;
}

export function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(randomFloat() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function isPlayable(token: Token, topToken: Token | null): boolean {
  if (topToken === null) return true;
  return token === topToken || token === nextToken(topToken);
}
