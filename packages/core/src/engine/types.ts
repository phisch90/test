import type { Ability, BonusType, Size } from "../schema/common.js";

/** Ein Beitrag zu einem Wert — bleibt IMMER erhalten (Breakdown-UI). */
export interface Contribution {
  /** Anzeige-Label der Quelle: „Ring der Ablenkung", „Talent: Dodge", „manuell". */
  source: string;
  bonusType: BonusType;
  value: number;
  /** false = von einem höheren gleichtypigen Bonus überdeckt („wirkt nicht"). */
  applied: boolean;
  /** Situativ („nur gegen Riesen") — zählt nicht in den Total, wird angezeigt. */
  condition?: string | undefined;
}

export interface StatValue {
  total: number;
  contributions: Contribution[];
}

export interface AbilityBlock {
  base: number;
  score: StatValue;
  mod: number;
}

export interface AcBlock {
  total: StatValue;
  touch: number;
  flatFooted: number;
}

export interface AttackLine {
  key: string;
  label: string;
  /** Iterative Angriffe: [+9, +4]. */
  bonuses: number[];
  attack: StatValue;
  /** „1d8+4" — Würfel + summierter Bonus. */
  damageText: string;
  damageBonus: StatValue;
  critical: string;
  notes: string[];
}

export interface SkillLine {
  skillId: string;
  name: string;
  /** false bei trainedOnly ohne Ränge („—"). */
  usable: boolean;
  total: StatValue;
  ranks: number;
  keyAbility: Ability | null;
  isClassSkill: boolean;
  maxRanks: number;
}

export interface SlotInfo {
  level: number;
  /** null = „—" (Grad nicht verfügbar); 0 = nur Bonus-Slots. */
  base: number | null;
  bonus: number;
  total: number | null;
  used: number;
}

export interface SpellcastingBlock {
  classId: string;
  className: string;
  model: "prepared" | "spontaneous";
  ability: Ability;
  abilityMod: number;
  casterLevel: StatValue;
  /** DC = dcBase + Zaubergrad. */
  dcBase: number;
  slots: SlotInfo[];
  spellsKnown: (number | null)[] | undefined;
  spellListId: string;
}

export interface EncumbranceBlock {
  loadLb: number;
  lightMaxLb: number;
  mediumMaxLb: number;
  heavyMaxLb: number;
  level: "light" | "medium" | "heavy" | "overloaded";
}

export interface FeatureLine {
  key: string;
  classId: string;
  className: string;
  level: number;
  name: string;
  description: string | undefined;
  /** Hat Toggle-Effekte (Rage an/aus). */
  toggleable: boolean;
  active: boolean;
}

export interface DerivedIssue {
  severity: "error" | "warning";
  code: string;
  /** Deutsch, direkt anzeigbar. */
  message: string;
  /** Entity-/Skill-ID etc. für Deep-Links. */
  ref?: string | undefined;
}

export interface DerivedSheet {
  abilities: Record<Ability, AbilityBlock>;
  size: Size;
  sizeModifier: number;
  totalLevel: number;
  /** Effektive Charakterstufe inkl. Level Adjustment. */
  ecl: number;
  classLevels: { classId: string; className: string; level: number }[];
  hp: { max: number; current: number; nonlethal: number; temp: number };
  ac: AcBlock;
  init: StatValue;
  speedFt: StatValue;
  bab: number;
  saves: Record<"fort" | "ref" | "will", StatValue>;
  grapple: StatValue;
  attacks: AttackLine[];
  skills: SkillLine[];
  skillPoints: { available: number; spent: number };
  featSlots: { available: number; used: number };
  spellcasting: SpellcastingBlock[];
  encumbrance: EncumbranceBlock;
  xp: { current: number; nextLevelAt: number | null };
  features: FeatureLine[];
  issues: DerivedIssue[];
}
