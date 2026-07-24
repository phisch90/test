import {
  CURRENT_SCHEMA_VERSION,
  DEFAULT_HOUSE_RULES,
  characterSchema,
  entitySchema,
  houseRulesSchema,
  type Character,
  type Entity,
  type HouseRules,
} from "@codex35/core";
import { db } from "./db.js";

/**
 * Migrations-Registry ab Tag 0: pure Funktionen je Ziel-schemaVersion.
 * Läuft lazy beim Laden und eager beim Import. v1 ist leer — aber verkabelt.
 */
const characterMigrations: Record<number, (raw: Record<string, unknown>) => Record<string, unknown>> = {};
const entityMigrations: Record<number, (raw: Record<string, unknown>) => Record<string, unknown>> = {};

function runMigrations(
  raw: Record<string, unknown>,
  registry: Record<number, (r: Record<string, unknown>) => Record<string, unknown>>,
): Record<string, unknown> {
  let doc = raw;
  let version = typeof doc.schemaVersion === "number" ? doc.schemaVersion : 1;
  while (version < CURRENT_SCHEMA_VERSION) {
    version += 1;
    const migrate = registry[version];
    if (migrate) doc = migrate(doc);
    doc = { ...doc, schemaVersion: version };
  }
  return doc;
}

export function migrateAndParseCharacter(raw: unknown): Character {
  return characterSchema.parse(runMigrations(raw as Record<string, unknown>, characterMigrations));
}

export function migrateAndParseEntity(raw: unknown): Entity {
  return entitySchema.parse(runMigrations(raw as Record<string, unknown>, entityMigrations));
}

const now = () => new Date().toISOString();

export const CharacterRepo = {
  async save(character: Character): Promise<Character> {
    const next = { ...character, rev: character.rev + 1, updatedAt: now() };
    await db.characters.put(next);
    return next;
  },

  async create(data: Omit<Character, "id" | "rev" | "updatedAt" | "schemaVersion">): Promise<Character> {
    const character = characterSchema.parse({
      ...data,
      id: crypto.randomUUID(),
      schemaVersion: CURRENT_SCHEMA_VERSION,
      rev: 1,
      updatedAt: now(),
    });
    await db.characters.put(character);
    return character;
  },

  /**
   * Mutation gegen den FRISCHEN DB-Stand in einer Transaktion — verhindert
   * Lost Updates bei schnellen Doppel-Taps (HP −1/−1, Slot-Pips), die sonst
   * beide denselben veralteten Render-Stand klonen würden.
   */
  async mutate(id: string, fn: (c: Character) => void): Promise<void> {
    await db.transaction("rw", db.characters, async () => {
      const current = await db.characters.get(id);
      if (!current || current.deletedAt) return;
      const copy = structuredClone(current);
      fn(copy);
      copy.rev = current.rev + 1;
      copy.updatedAt = now();
      await db.characters.put(copy);
    });
  },

  /** Tombstone, nie physisch löschen (Sync-Seam). */
  async remove(character: Character): Promise<void> {
    await db.characters.put({ ...character, deletedAt: now(), rev: character.rev + 1, updatedAt: now() });
  },
};

export const CompendiumRepo = {
  async saveHomebrew(entity: Entity): Promise<Entity> {
    if (entity.source !== "homebrew") throw new Error("SRD-Einträge sind unveränderlich — nutze Überschreiben.");
    const next = { ...entity, rev: entity.rev + 1, updatedAt: now() };
    await db.entities.put(next);
    return next;
  },

  async remove(entity: Entity): Promise<void> {
    if (entity.source !== "homebrew") throw new Error("SRD-Einträge können nicht gelöscht werden.");
    await db.entities.put({ ...entity, deletedAt: now(), rev: entity.rev + 1, updatedAt: now() });
  },
};

const HOUSE_RULES_KEY = "houseRules";

export const SettingsRepo = {
  async getHouseRules(): Promise<HouseRules> {
    const row = await db.settings.get(HOUSE_RULES_KEY);
    if (!row) return DEFAULT_HOUSE_RULES;
    const parsed = houseRulesSchema.safeParse(row.value);
    return parsed.success ? parsed.data : DEFAULT_HOUSE_RULES;
  },
  async setHouseRules(rules: HouseRules): Promise<void> {
    await db.settings.put({ key: HOUSE_RULES_KEY, value: rules });
  },
};
