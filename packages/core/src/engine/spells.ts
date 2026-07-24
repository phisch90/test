import type { Entity, SpellEntity } from "../schema/entities.js";

export interface SpellListEntry {
  spellId: string;
  level: number;
  spell: SpellEntity | null;
}

/**
 * Zauber einer Zauberliste (spelllist-Entity) auflösen — sortiert nach Grad,
 * dann Name. Fehlende Zauber-Referenzen bleiben als null erhalten (die UI
 * kann sie ausblenden oder anzeigen), die Liste crasht nie.
 */
export function spellsForList(
  compendium: Map<string, Entity>,
  spellListId: string,
): SpellListEntry[] {
  const list = compendium.get(spellListId);
  if (!list || list.kind !== "spelllist" || list.deletedAt) return [];

  const entries: SpellListEntry[] = Object.entries(list.data.spells).map(([spellId, level]) => {
    const entity = compendium.get(spellId);
    const spell = entity && entity.kind === "spell" && !entity.deletedAt ? entity : null;
    return { spellId, level, spell };
  });

  entries.sort((a, b) => {
    if (a.level !== b.level) return a.level - b.level;
    const nameA = a.spell?.name ?? a.spellId;
    const nameB = b.spell?.name ?? b.spellId;
    return nameA.localeCompare(nameB);
  });
  return entries;
}
