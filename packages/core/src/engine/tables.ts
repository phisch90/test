import type { Size } from "../schema/common.js";

export function abilityModifier(score: number): number {
  return Math.floor((score - 10) / 2);
}

/** Kumulative XP für Stufe n (PHB-Tabelle 3-2): 500·n·(n−1). */
export function xpForLevel(level: number): number {
  return 500 * level * (level - 1);
}

/** Größenmodifikator auf Angriff und RK (PHB-Tabelle 8-1). */
export const SIZE_MODIFIER: Record<Size, number> = {
  fine: 8,
  diminutive: 4,
  tiny: 2,
  small: 1,
  medium: 0,
  large: -1,
  huge: -2,
  gargantuan: -4,
  colossal: -8,
};

/** Sondergrößenmodifikator auf Ringkampf (4er-Schritte). */
export const GRAPPLE_SIZE_MODIFIER: Record<Size, number> = {
  fine: -16,
  diminutive: -12,
  tiny: -8,
  small: -4,
  medium: 0,
  large: 4,
  huge: 8,
  gargantuan: 12,
  colossal: 16,
};

/** Maximale schwere Last (lb) je Stärkewert 1–29 (PHB-Tabelle 9-1). */
const HEAVY_LOAD: Record<number, number> = {
  1: 10, 2: 20, 3: 30, 4: 40, 5: 50, 6: 60, 7: 70, 8: 80, 9: 90, 10: 100,
  11: 115, 12: 130, 13: 150, 14: 175, 15: 200, 16: 230, 17: 260, 18: 300,
  19: 350, 20: 400, 21: 460, 22: 520, 23: 600, 24: 700, 25: 800, 26: 920,
  27: 1040, 28: 1200, 29: 1400,
};

/** Traglast-Multiplikator nach Größe (Zweibeiner, PHB S. 162). */
const CARRY_SIZE_MULTIPLIER: Record<Size, number> = {
  fine: 0.125,
  diminutive: 0.25,
  tiny: 0.5,
  small: 0.75,
  medium: 1,
  large: 2,
  huge: 4,
  gargantuan: 8,
  colossal: 16,
};

export function carryingCapacity(
  strScore: number,
  size: Size,
): { lightMaxLb: number; mediumMaxLb: number; heavyMaxLb: number } {
  let heavy: number;
  if (strScore <= 0) heavy = 0;
  else if (strScore <= 29) heavy = HEAVY_LOAD[strScore] ?? 0;
  else {
    // >29: pro vollen 10 Punkten über der 20–29-Zeile mit gleicher Einerstelle ×4.
    let s = strScore;
    let factor = 1;
    while (s > 29) {
      s -= 10;
      factor *= 4;
    }
    heavy = (HEAVY_LOAD[s] ?? 0) * factor;
  }
  heavy = Math.floor(heavy * CARRY_SIZE_MULTIPLIER[size]);
  return {
    lightMaxLb: Math.floor(heavy / 3),
    mediumMaxLb: Math.floor((heavy * 2) / 3),
    heavyMaxLb: heavy,
  };
}

/** Mittlere/schwere Last: MaxGE und Rüstungsmalus (PHB-Tabelle 9-2). */
export const LOAD_LIMITS = {
  medium: { maxDex: 3, acp: -3 },
  heavy: { maxDex: 1, acp: -6 },
} as const;

/** Bewegungsreduktion durch mittlere/schwere Rüstung oder Last (PHB-Tabelle 9-3). */
export function reducedSpeed(baseFt: number): number {
  return Math.ceil((baseFt * 2) / 3 / 5) * 5;
}

/**
 * Bonuszauber je Attributsmodifikator und Zaubergrad (PHB-Tabelle 1-1).
 * Grad 0 erhält nie Bonuszauber.
 */
export function bonusSpells(abilityMod: number, spellLevel: number): number {
  if (spellLevel < 1 || abilityMod < spellLevel) return 0;
  return Math.floor((abilityMod - spellLevel) / 4) + 1;
}

/** Maximale Ränge: Klassenfertigkeit Stufe+3, sonst die Hälfte (PHB S. 62). */
export function maxRanks(totalLevel: number, isClassSkill: boolean): number {
  const max = totalLevel + 3;
  return isClassSkill ? max : max / 2;
}

/** Durchschnittlicher TW-Wurf (abgerundet), z.B. W8 → 4. */
export function averageHitDie(die: number): number {
  return Math.floor((die + 1) / 2);
}

/** Anzahl Angriffe aus Basis-BAB: +6 → 2, +11 → 3, +16 → 4. */
export function iterativeAttacks(bab: number): number[] {
  const count = bab <= 0 ? 1 : Math.min(4, 1 + Math.floor((bab - 1) / 5));
  const result: number[] = [];
  for (let i = 0; i < count; i++) result.push(bab - i * 5);
  return result;
}

/** Talent-Slots aus der Charakterstufe: 1. Stufe + alle 3 Stufen (PHB S. 87). */
export function baseFeatSlots(totalLevel: number): number {
  if (totalLevel < 1) return 0;
  return 1 + Math.floor(totalLevel / 3);
}

/** Anzahl Attributssteigerungen (je 4. Stufe). */
export function abilityIncreaseCount(totalLevel: number): number {
  return Math.floor(totalLevel / 4);
}

/** Fraktionale Progression (Unearthed Arcana) — nur für die Hausregel. */
export function fractionalBab(template: "good" | "average" | "poor", level: number): number {
  switch (template) {
    case "good":
      return level;
    case "average":
      return level * 0.75;
    case "poor":
      return level * 0.5;
  }
}

export function fractionalSave(template: "good" | "poor", level: number): number {
  return template === "good" ? 2 + level / 2 : level / 3;
}
