// Core card model — pure, framework-free so it can run in UI or an Edge Function later.

export type Suit = 'hearts' | 'diamonds' | 'spades' | 'clubs';
export type Rank =
  | 'A' | '2' | '3' | '4' | '5' | '6' | '7'
  | '8' | '9' | '10' | 'J' | 'Q' | 'K' | 'JOKER';

export interface Card {
  id: string;
  suit: Suit | 'none';
  rank: Rank;
}

export const SUITS: Suit[] = ['hearts', 'diamonds', 'spades', 'clubs'];
export const RANKS: Rank[] = ['A','2','3','4','5','6','7','8','9','10','J','Q','K'];

export function buildDeck(includeJokers: boolean): Card[] {
  const deck: Card[] = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push({ id: `${rank}-${suit}`, suit, rank });
    }
  }
  if (includeJokers) {
    deck.push({ id: 'JOKER-1', suit: 'none', rank: 'JOKER' });
    deck.push({ id: 'JOKER-2', suit: 'none', rank: 'JOKER' });
  }
  return deck;
}

/** Fisher-Yates. Pass a custom random for deterministic tests. */
export function shuffle<T>(arr: T[], random: () => number = Math.random): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function cardLabel(c: Card): string {
  if (c.rank === 'JOKER') return 'Joker';
  const suitGlyph: Record<Suit, string> = {
    hearts: '♥', diamonds: '♦', spades: '♠', clubs: '♣',
  };
  return `${c.rank}${c.suit === 'none' ? '' : suitGlyph[c.suit as Suit]}`;
}

export function isRedSuit(suit: Card['suit']): boolean {
  return suit === 'hearts' || suit === 'diamonds';
}

/** Joker color is derived from id: JOKER-1 is red, JOKER-2 is black. */
export function jokerColor(card: Card): 'red' | 'black' | null {
  if (card.rank !== 'JOKER') return null;
  return card.id === 'JOKER-2' ? 'black' : 'red';
}

/** Color family for penalty matching: red = hearts/diamonds/red-Joker, black = spades/clubs/black-Joker. */
export function colorFamilyOf(card: Card): 'red' | 'black' | null {
  if (card.rank === 'JOKER') return jokerColor(card);
  if (card.suit === 'hearts' || card.suit === 'diamonds') return 'red';
  if (card.suit === 'spades' || card.suit === 'clubs') return 'black';
  return null;
}
