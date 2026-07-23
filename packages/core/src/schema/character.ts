import { z } from "zod";
import { abilitySchema, bonusTypeSchema, statPathSchema } from "./common.js";
import { effectSchema, entitySchema } from "./entities.js";

export const CURRENT_SCHEMA_VERSION = 1;
export const CURRENT_EXPORT_FORMAT_VERSION = 1;

/**
 * Hausregeln — flach, als Parameter in die Engine gereicht.
 * Toggles werden on demand ergänzt, nichts auf Verdacht.
 */
export const houseRulesSchema = z.object({
  /** UA: BAB/Saves als Brüche über Klassen summiert, einmal gerundet. */
  fractionalBabAndSaves: z.boolean().default(false),
  /** RAW: volle TP auf Stufe 1. */
  maxHpFirstLevel: z.boolean().default(true),
  /** RAW-Regel, die kaum ein Tisch spielt — Default aus. Warn-only. */
  multiclassXpPenalty: z.boolean().default(false),
  deathAt: z.enum(["minus10", "negCon"]).default("minus10"),
  pointBuyBudget: z.number().int().optional(),
});
export type HouseRules = z.infer<typeof houseRulesSchema>;
export const DEFAULT_HOUSE_RULES: HouseRules = houseRulesSchema.parse({});

/**
 * Charakter speichert nur ROHE Entscheidungen — nichts Abgeleitetes.
 * Alles Berechnete kommt aus deriveSheet().
 */
export const characterSchema = z.object({
  id: z.string(),
  schemaVersion: z.number().int().default(CURRENT_SCHEMA_VERSION),
  rev: z.number().int().default(1),
  updatedAt: z.string().default(""),
  deletedAt: z.string().optional(),

  name: z.string(),
  playerName: z.string().optional(),
  /** Data-URL (Porträts der Gruppe sind PNGs). */
  portrait: z.string().optional(),
  alignment: z.string().optional(),
  deity: z.string().optional(),

  abilities: z.object({
    method: z.enum(["rolled", "pointbuy"]).default("rolled"),
    base: z.object({
      str: z.number().int(),
      dex: z.number().int(),
      con: z.number().int(),
      int: z.number().int(),
      wis: z.number().int(),
      cha: z.number().int(),
    }),
    /** Attributssteigerung je 4. Charakterstufe (Index 0 = Stufe 4). */
    levelUps: z.array(abilitySchema.nullable()).default([]),
  }),

  raceId: z.string(),

  /** Geordnete Stufen-Liste = Multiclass-Timeline. */
  levels: z
    .array(
      z.object({
        classId: z.string(),
        hpRoll: z.union([z.number().int(), z.literal("max"), z.literal("avg")]),
      }),
    )
    .default([]),

  /** Flach; Klassen-/Cross-Class-Bewertung übernimmt validate (warn-only). */
  skillRanks: z.record(z.string(), z.number()).default({}),

  feats: z
    .array(
      z.object({
        featId: z.string(),
        /** „Weapon Focus (Langschwert)". */
        choice: z.string().optional(),
      }),
    )
    .default([]),

  inventory: z
    .array(
      z.object({
        /** Instanz-ID (ein Charakter kann zwei Langschwerter tragen). */
        id: z.string(),
        /** Kompendium-Referenz; fehlt bei komplett freien Zeilen. */
        itemId: z.string().optional(),
        customName: z.string().optional(),
        qty: z.number().int().default(1),
        equipped: z.boolean().default(false),
        weightLbOverride: z.number().optional(),
        /** z.B. das +1 des individuellen Schwertes. */
        extraEffects: z.array(effectSchema).default([]),
        notes: z.string().optional(),
      }),
    )
    .default([]),

  money: z
    .object({
      pp: z.number().int().default(0),
      gp: z.number().int().default(0),
      sp: z.number().int().default(0),
      cp: z.number().int().default(0),
    })
    .default({ pp: 0, gp: 0, sp: 0, cp: 0 }),

  /** Je Klassen-ID. */
  spellState: z
    .record(
      z.string(),
      z.object({
        known: z.array(z.string()).default([]),
        prepared: z
          .array(z.object({ spellId: z.string(), slotLevel: z.number().int() }))
          .default([]),
        /** Index = Zaubergrad. */
        usedSlots: z.array(z.number().int()).default([]),
      }),
    )
    .default({}),

  hp: z
    .object({
      damage: z.number().int().default(0),
      nonlethal: z.number().int().default(0),
      temp: z.number().int().default(0),
      overrideMax: z.number().int().optional(),
    })
    .default({ damage: 0, nonlethal: 0, temp: 0 }),

  xp: z.number().int().default(0),

  /** Referenzen auf condition-Entities. */
  conditionIds: z.array(z.string()).default([]),

  /** Aktive Toggles; Key = `${entityId}#${effectIndex}` (z.B. Rage an). */
  toggledEffectKeys: z.array(z.string()).default([]),

  /** DER Notausgang — Provenienz „manuell". Macht Homebrew ab Tag 1 spielbar. */
  miscModifiers: z
    .array(
      z.object({
        id: z.string(),
        target: statPathSchema,
        bonusType: bonusTypeSchema.default("untyped"),
        value: z.number(),
        note: z.string().default(""),
      }),
    )
    .default([]),

  languages: z.string().optional(),
  notes: z.string().default(""),
  x: z.record(z.string(), z.unknown()).optional(),
});
export type Character = z.infer<typeof characterSchema>;

/**
 * Export-Envelope. Referenziertes Homebrew wird immer eingebettet, SRD nie
 * (stabile Slugs lösen beim Empfänger auf). Kanonisch sortiert serialisieren!
 */
export const exportEnvelopeSchema = z.object({
  formatVersion: z.number().int(),
  exportedAt: z.string(),
  app: z.string().default("codex35"),
  characters: z.array(characterSchema).default([]),
  homebrewEntities: z.array(entitySchema).default([]),
  houseRules: houseRulesSchema.optional(),
});
export type ExportEnvelope = z.infer<typeof exportEnvelopeSchema>;

/** Stabil key-sortiertes JSON — diffbare Exporte, deterministische Packs. */
export function canonicalJson(value: unknown, indent = 2): string {
  return JSON.stringify(sortKeys(value), null, indent);
}

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value !== null && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      out[key] = sortKeys((value as Record<string, unknown>)[key]);
    }
    return out;
  }
  return value;
}
