import { STACKING_BONUS_TYPES, type StatPath } from "../schema/common.js";
import type { ActiveEffect } from "./internal.js";
import type { Contribution, StatValue } from "./types.js";

/**
 * Stufe 5 — stack: 3.5-Stacking. Innerhalb eines Bonustyps zählt nur der
 * höchste Wert, AUSSER dodge/circumstance/untyped (summieren). Mali (negativ)
 * summieren immer. Situative Beiträge (condition-Text) zählen nie in den Total,
 * bleiben aber sichtbar. Jeder Beitrag behält `applied` — das speist die
 * Breakdown-UI („+2 Ablenkung (Ring) — wirkt nicht, überdeckt von +3").
 */
export function stackContributions(raw: Contribution[]): StatValue {
  const contributions = raw.map((c) => ({ ...c }));

  // Situative Beiträge markieren.
  for (const c of contributions) {
    if (c.condition) c.applied = false;
  }

  const unconditional = contributions.filter((c) => !c.condition);

  // Positive Beiträge nicht-stackender Typen: nur das Maximum je Typ wirkt.
  const byType = new Map<string, Contribution[]>();
  for (const c of unconditional) {
    if (c.value <= 0) {
      c.applied = true; // Mali und Nullen summieren immer.
      continue;
    }
    if (STACKING_BONUS_TYPES.has(c.bonusType)) {
      c.applied = true;
      continue;
    }
    const list = byType.get(c.bonusType) ?? [];
    list.push(c);
    byType.set(c.bonusType, list);
  }
  for (const list of byType.values()) {
    let best: Contribution | null = null;
    for (const c of list) {
      if (!best || c.value > best.value) best = c;
    }
    for (const c of list) c.applied = c === best;
  }

  const total = contributions.reduce((sum, c) => sum + (c.applied ? c.value : 0), 0);
  return { total, contributions };
}

export type Buckets = Map<string, ActiveEffect[]>;

/** Effekte nach Ziel-Pfad gruppieren. */
export function toBuckets(effects: ActiveEffect[]): Buckets {
  const buckets: Buckets = new Map();
  for (const effect of effects) {
    const list = buckets.get(effect.target) ?? [];
    list.push(effect);
    buckets.set(effect.target, list);
  }
  return buckets;
}

export function toContribution(effect: ActiveEffect): Contribution {
  return {
    source: effect.source,
    bonusType: effect.bonusType,
    value: effect.value,
    applied: true,
    condition: effect.condition,
  };
}

/**
 * Beiträge aus einem oder mehreren Buckets plus Basis-Beiträgen stapeln.
 * Item-gescopte Effekte (attack.self/damage.self) müssen vorgefiltert kommen.
 */
export function stackPaths(
  buckets: Buckets,
  paths: StatPath[],
  base: Contribution[] = [],
): StatValue {
  const contributions: Contribution[] = [...base];
  for (const path of paths) {
    for (const effect of buckets.get(path) ?? []) {
      contributions.push(toContribution(effect));
    }
  }
  return stackContributions(contributions);
}

/** Basis-Beitrag (zählt immer, stackt mit allem — z.B. „Basis 10" der RK). */
export function baseContribution(source: string, value: number): Contribution {
  return { source, bonusType: "untyped", value, applied: true, condition: undefined };
}

/** Summe eines Flag-Buckets (flag:<name>) — >0 heißt gesetzt. */
export function flagSet(buckets: Buckets, flag: `flag:${string}`): boolean {
  return (buckets.get(flag) ?? []).reduce((sum, e) => sum + e.value, 0) > 0;
}
