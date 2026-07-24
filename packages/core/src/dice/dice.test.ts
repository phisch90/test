import { describe, expect, it } from "vitest";
import { d20Plus, parseDice, rollDice } from "./dice.js";

/** Deterministischer LCG für Tests. */
function seededRng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

describe("parseDice", () => {
  it("parst Standardausdrücke", () => {
    expect(parseDice("2d6+3")).toMatchObject({
      terms: [{ sign: 1, count: 2, sides: 6 }],
      modifier: 3,
    });
    expect(parseDice("d20")).toMatchObject({ terms: [{ count: 1, sides: 20 }], modifier: 0 });
    expect(parseDice("1d8 + 2d6 - 1")).toMatchObject({
      terms: [
        { sign: 1, count: 1, sides: 8 },
        { sign: 1, count: 2, sides: 6 },
      ],
      modifier: -1,
    });
  });

  it("versteht deutsche Schreibweise (2W6)", () => {
    expect(parseDice("2W6+1")).toMatchObject({
      terms: [{ count: 2, sides: 6 }],
      modifier: 1,
    });
  });

  it("weist Unsinn zurück", () => {
    expect(parseDice("")).toBeNull();
    expect(parseDice("foo")).toBeNull();
    expect(parseDice("2d")).toBeNull();
    expect(parseDice("1d6 7")).toBeNull(); // fehlendes Vorzeichen
    expect(parseDice("999d999999")).toBeNull();
  });
});

describe("rollDice", () => {
  it("bleibt in den Grenzen und addiert den Modifikator", () => {
    const expr = parseDice("4d6+2")!;
    const rng = seededRng(42);
    for (let i = 0; i < 200; i++) {
      const result = rollDice(expr, rng);
      expect(result.total).toBeGreaterThanOrEqual(4 + 2);
      expect(result.total).toBeLessThanOrEqual(24 + 2);
      for (const roll of result.rolls) {
        for (const v of roll.values) {
          expect(v).toBeGreaterThanOrEqual(1);
          expect(v).toBeLessThanOrEqual(6);
        }
      }
    }
  });

  it("ist mit gleichem Seed deterministisch", () => {
    const expr = parseDice("3d8")!;
    const a = rollDice(expr, seededRng(7));
    const b = rollDice(expr, seededRng(7));
    expect(a.total).toBe(b.total);
  });
});

describe("d20Plus", () => {
  it("baut den tap-to-roll-Ausdruck", () => {
    expect(d20Plus(5).text).toBe("1d20+5");
    expect(d20Plus(-2).text).toBe("1d20-2");
    expect(d20Plus(0).text).toBe("1d20");
  });
});
