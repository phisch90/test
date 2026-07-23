import { z } from "zod";

export const ABILITIES = ["str", "dex", "con", "int", "wis", "cha"] as const;
export const abilitySchema = z.enum(ABILITIES);
export type Ability = z.infer<typeof abilitySchema>;

export const SIZES = [
  "fine",
  "diminutive",
  "tiny",
  "small",
  "medium",
  "large",
  "huge",
  "gargantuan",
  "colossal",
] as const;
export const sizeSchema = z.enum(SIZES);
export type Size = z.infer<typeof sizeSchema>;

/**
 * 3.5-Bonustypen. Stacking-Regel (Engine-Stufe "stack"):
 * gleicher Typ → nur der höchste zählt, AUSSER dodge/circumstance/untyped (summieren).
 * Mali (negative Werte) summieren immer.
 */
export const BONUS_TYPES = [
  "enhancement",
  "morale",
  "luck",
  "sacred",
  "profane",
  "insight",
  "competence",
  "deflection",
  "dodge",
  "natural",
  "armor",
  "shield",
  "size",
  "resistance",
  "circumstance",
  "racial",
  "alchemical",
  "inherent",
  "untyped",
] as const;
export const bonusTypeSchema = z.enum(BONUS_TYPES);
export type BonusType = z.infer<typeof bonusTypeSchema>;

/** Bonustypen, die innerhalb desselben Typs stacken. */
export const STACKING_BONUS_TYPES: ReadonlySet<BonusType> = new Set([
  "dodge",
  "circumstance",
  "untyped",
]);

/**
 * Ziel eines Effects. Feste Pfade plus präfixierte dynamische Pfade:
 *   `skill:<entityId>` — eine konkrete Fertigkeit
 *   `cl:<classId>`     — Zauberstufe einer Klasse (`cl` = alle)
 *   `flag:<name>`      — boolesche Schalter (z.B. flag:weaponFinesse)
 */
export type StatPath =
  | `ability.${Ability}`
  | "ac"
  | "save.fort"
  | "save.ref"
  | "save.will"
  | "save.all"
  | "attack.melee"
  | "attack.ranged"
  | "attack.all"
  | "attack.self"
  | "damage.melee"
  | "damage.ranged"
  | "damage.all"
  | "damage.self"
  | "init"
  | "speed.land"
  | "hp.max"
  | "grapple"
  | "dc.spells"
  | "sr"
  | "feats.slots"
  | "skills.pointsPerLevel"
  | "skill.all"
  | "cl"
  | `skill:${string}`
  | `cl:${string}`
  | `flag:${string}`;

const FIXED_STAT_PATHS: ReadonlySet<string> = new Set([
  ...ABILITIES.map((a) => `ability.${a}`),
  "ac",
  "save.fort",
  "save.ref",
  "save.will",
  "save.all",
  "attack.melee",
  "attack.ranged",
  "attack.all",
  "attack.self",
  "damage.melee",
  "damage.ranged",
  "damage.all",
  "damage.self",
  "init",
  "speed.land",
  "hp.max",
  "grapple",
  "dc.spells",
  "sr",
  "feats.slots",
  "skills.pointsPerLevel",
  "skill.all",
  "cl",
]);

export function isStatPath(value: string): value is StatPath {
  return (
    FIXED_STAT_PATHS.has(value) ||
    value.startsWith("skill:") ||
    value.startsWith("cl:") ||
    value.startsWith("flag:")
  );
}

export const statPathSchema = z
  .string()
  .refine(isStatPath, { message: "Unbekannter StatPath" }) as z.ZodType<StatPath>;

/** Deutsche Übersetzungs-Overlays; SRD-Inhalte bleiben englisch. */
export const localizedSchema = z.object({
  de: z
    .object({
      name: z.string().optional(),
      summary: z.string().optional(),
      description: z.string().optional(),
    })
    .optional(),
});
export type Localized = z.infer<typeof localizedSchema>;
