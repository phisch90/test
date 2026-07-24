/**
 * Handgerollter Parser für 3.5-Würfelausdrücke: "d20", "2d6+3", "1d8+2d6-1".
 * Kein eval, keine Library — die Grammatik ist winzig.
 */

export interface DiceTerm {
  sign: 1 | -1;
  count: number;
  sides: number;
}

export interface DiceExpression {
  terms: DiceTerm[];
  modifier: number;
  text: string;
}

const TOKEN = /([+-]?)\s*(?:(\d*)[dw](\d+)|(\d+))/giy;

export function parseDice(input: string): DiceExpression | null {
  const text = input.trim();
  if (!text) return null;
  const terms: DiceTerm[] = [];
  let modifier = 0;
  let pos = 0;
  let first = true;

  TOKEN.lastIndex = 0;
  while (pos < text.length) {
    TOKEN.lastIndex = pos;
    const match = TOKEN.exec(text);
    if (!match || match.index !== pos) return null;
    const [, signText, countText, sidesText, flatText] = match;
    if (!first && !signText) return null;
    const sign: 1 | -1 = signText === "-" ? -1 : 1;
    if (sidesText !== undefined) {
      const count = countText ? parseInt(countText, 10) : 1;
      const sides = parseInt(sidesText, 10);
      if (count < 1 || count > 100 || sides < 1 || sides > 1000) return null;
      terms.push({ sign, count, sides });
    } else if (flatText !== undefined) {
      modifier += sign * parseInt(flatText, 10);
    }
    pos = TOKEN.lastIndex;
    // Whitespace zwischen Tokens überspringen.
    while (pos < text.length && text[pos] === " ") pos++;
    first = false;
  }
  if (terms.length === 0 && modifier === 0) return null;
  return { terms, modifier, text };
}

export interface RollResult {
  total: number;
  /** Einzelwürfe je Term, in Term-Reihenfolge. */
  rolls: { sides: number; values: number[]; sign: 1 | -1 }[];
  modifier: number;
  expression: string;
}

/**
 * Würfeln mit injiziertem Zufall (rng: () => [0,1)) — die Engine bleibt pur,
 * die App reicht crypto-basierten Zufall rein.
 */
export function rollDice(expr: DiceExpression, rng: () => number): RollResult {
  const rolls: RollResult["rolls"] = [];
  let total = expr.modifier;
  for (const term of expr.terms) {
    const values: number[] = [];
    for (let i = 0; i < term.count; i++) {
      const value = 1 + Math.floor(rng() * term.sides);
      values.push(value);
      total += term.sign * value;
    }
    rolls.push({ sides: term.sides, values, sign: term.sign });
  }
  return { total, rolls, modifier: expr.modifier, expression: expr.text };
}

/** Bequemlichkeit: "1W20+5"-Wurf für tap-to-roll (Modifikator vorbefüllt). */
export function d20Plus(modifier: number): DiceExpression {
  const text = modifier === 0 ? "1d20" : `1d20${modifier > 0 ? "+" : ""}${modifier}`;
  return { terms: [{ sign: 1, count: 1, sides: 20 }], modifier, text };
}
