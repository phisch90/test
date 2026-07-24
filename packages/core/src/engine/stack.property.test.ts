import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { BONUS_TYPES, STACKING_BONUS_TYPES } from "../schema/common.js";
import { stackContributions } from "./stack.js";
import type { Contribution } from "./types.js";

const contributionArb: fc.Arbitrary<Contribution> = fc.record({
  source: fc.string({ minLength: 1, maxLength: 8 }),
  bonusType: fc.constantFrom(...BONUS_TYPES),
  value: fc.integer({ min: -20, max: 20 }),
  applied: fc.boolean(), // Input-Wert ist egal — stack entscheidet neu.
  condition: fc.option(fc.string({ minLength: 1, maxLength: 8 }), { nil: undefined }),
});

describe("stackContributions — Invarianten (fast-check)", () => {
  it("Total = Summe der angewendeten Beiträge", () => {
    fc.assert(
      fc.property(fc.array(contributionArb, { maxLength: 25 }), (contribs) => {
        const { total, contributions } = stackContributions(contribs);
        const sum = contributions.reduce((s, c) => s + (c.applied ? c.value : 0), 0);
        expect(total).toBe(sum);
      }),
    );
  });

  it("situative Beiträge (condition) sind nie angewendet", () => {
    fc.assert(
      fc.property(fc.array(contributionArb, { maxLength: 25 }), (contribs) => {
        const { contributions } = stackContributions(contribs);
        for (const c of contributions) {
          if (c.condition) expect(c.applied).toBe(false);
        }
      }),
    );
  });

  it("nicht-stackende Typen: höchstens EIN positiver Beitrag je Typ wirkt", () => {
    fc.assert(
      fc.property(fc.array(contributionArb, { maxLength: 25 }), (contribs) => {
        const { contributions } = stackContributions(contribs);
        for (const type of BONUS_TYPES) {
          if (STACKING_BONUS_TYPES.has(type)) continue;
          const appliedPositive = contributions.filter(
            (c) => c.bonusType === type && c.value > 0 && c.applied,
          );
          expect(appliedPositive.length).toBeLessThanOrEqual(1);
        }
      }),
    );
  });

  it("Mali (unbedingt) wirken immer", () => {
    fc.assert(
      fc.property(fc.array(contributionArb, { maxLength: 25 }), (contribs) => {
        const { contributions } = stackContributions(contribs);
        for (const c of contributions) {
          if (!c.condition && c.value <= 0) expect(c.applied).toBe(true);
        }
      }),
    );
  });

  it("Total ist permutationsinvariant", () => {
    fc.assert(
      fc.property(
        fc.array(contributionArb, { maxLength: 15 }),
        fc.infiniteStream(fc.nat()),
        (contribs, seeds) => {
          const shuffled = [...contribs];
          // Fisher-Yates mit fast-check-Seeds (deterministisch pro Run).
          const iter = seeds[Symbol.iterator]();
          for (let i = shuffled.length - 1; i > 0; i--) {
            const j = (iter.next().value as number) % (i + 1);
            [shuffled[i], shuffled[j]] = [shuffled[j]!, shuffled[i]!];
          }
          expect(stackContributions(shuffled).total).toBe(stackContributions(contribs).total);
        },
      ),
    );
  });

  it("Monotonie: ein zusätzlicher unbedingter positiver Beitrag senkt den Total nie", () => {
    fc.assert(
      fc.property(
        fc.array(contributionArb, { maxLength: 20 }),
        contributionArb,
        (contribs, extraRaw) => {
          const extra: Contribution = {
            ...extraRaw,
            value: Math.abs(extraRaw.value),
            condition: undefined,
          };
          const before = stackContributions(contribs).total;
          const after = stackContributions([...contribs, extra]).total;
          expect(after).toBeGreaterThanOrEqual(before);
        },
      ),
    );
  });
});
