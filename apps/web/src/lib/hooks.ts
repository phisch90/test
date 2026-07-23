import { useMemo } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import {
  DEFAULT_HOUSE_RULES,
  deriveSheet,
  houseRulesSchema,
  resolveCompendium,
  type Character,
  type DerivedSheet,
  type Entity,
  type HouseRules,
} from "@codex35/core";
import { db } from "../db/db.js";

export function useAllEntities(): Entity[] | undefined {
  return useLiveQuery(() => db.entities.toArray(), []);
}

/** Aufgelöste Kompendium-Map (Shadowing angewendet). */
export function useCompendium(): Map<string, Entity> | undefined {
  const entities = useAllEntities();
  return useMemo(() => (entities ? resolveCompendium(entities) : undefined), [entities]);
}

export function useCharacters(): Character[] | undefined {
  return useLiveQuery(
    async () =>
      (await db.characters.toArray())
        .filter((c) => !c.deletedAt)
        .sort((a, b) => a.name.localeCompare(b.name)),
    [],
  );
}

export function useCharacter(id: string): Character | undefined | null {
  return useLiveQuery(async () => {
    const character = await db.characters.get(id);
    return character && !character.deletedAt ? character : null;
  }, [id]);
}

export function useHouseRules(): HouseRules {
  const row = useLiveQuery(() => db.settings.get("houseRules"), []);
  return useMemo(() => {
    if (!row) return DEFAULT_HOUSE_RULES;
    const parsed = houseRulesSchema.safeParse(row.value);
    return parsed.success ? parsed.data : DEFAULT_HOUSE_RULES;
  }, [row]);
}

/** Der abgeleitete Bogen — nie State, immer berechnet. */
export function useSheet(character: Character | undefined | null): DerivedSheet | undefined {
  const compendium = useCompendium();
  const houseRules = useHouseRules();
  return useMemo(
    () => (character && compendium ? deriveSheet(character, compendium, houseRules) : undefined),
    [character, compendium, houseRules],
  );
}
