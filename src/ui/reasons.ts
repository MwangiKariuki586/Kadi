import type { Suit } from "../engine/cards";

/** Plain-language reason for a rejected combo — shared by the table and How to Play. */
export function reasonText(
  reason: string | null,
  activeSuit?: Suit | null,
): string {
  switch (reason) {
    case "NO_MATCH":
      if (activeSuit) {
        const glyph =
          activeSuit === "hearts"
            ? "♥"
            : activeSuit === "diamonds"
              ? "♦"
              : activeSuit === "spades"
                ? "♠"
                : "♣";
        const name = activeSuit.charAt(0).toUpperCase() + activeSuit.slice(1);
        return `Must follow ${name} ${glyph} — Ace called it.`;
      }
      return "Must match suit or rank of the top card.";
    case "QUESTION_NEEDS_ANSWER":
      return "Q / 8 needs a same-suit answer (4 5 6 7 9 10) in the same move.";
    case "PENALTY_MUST_STACK_OR_BLOCK":
      return "2 / 3 / Joker only stack with other penalties — never with normal cards. Stack, block with Ace, or eat.";
    case "ACE_ONLY_STACKS_WITH_ACE":
      return "An Ace plays solo, with another Ace, or as the answer to Q / 8 (any suit) — never with other normal cards.";
    case "MUST_BE_SAME_RANK":
      return "Combos share one rank — e.g. 7♥ + 7♠. Questions stack (Q/8) and the answer matches the last question (4 5 6 7 9 10 same suit, or Ace any suit); J/K stack together.";
    case "SKIP_MUST_COUNTER_OR_ACCEPT":
      return "Jump! Refuse with any single J to keep your turn, or accept the skip. Stacks can't be refused.";
    case "REVERSE_MUST_COUNTER_OR_ACCEPT":
      return "Kickback! Refuse with any single K to keep your turn, or accept the reversal. Stacks can't be refused.";
    case "UNMET_REQUEST":
      return "Super Ace demand: play the exact card, an Ace, or pick.";
    case "NOT_YOUR_TURN":
      return "Wait for your turn…";
    default:
      return "That move is not legal.";
  }
}
