import type { Character } from "../schema/character.js";
import type { Entity } from "../schema/entities.js";
import type { DerivedIssue } from "./types.js";
import type { ResolvedCharacter } from "./internal.js";

/**
 * Stufe 1 — resolve: Referenzen auflösen. Fehlende Einträge werden zu issues,
 * NIE zu Exceptions: der Bogen degradiert und warnt, er crasht nicht.
 */
export function resolve(
  character: Character,
  compendium: Map<string, Entity>,
): ResolvedCharacter {
  const issues: DerivedIssue[] = [];

  const get = <K extends Entity["kind"]>(
    id: string,
    kind: K,
    label: string,
  ): Extract<Entity, { kind: K }> | null => {
    const entity = compendium.get(id);
    if (!entity || entity.deletedAt) {
      issues.push({
        severity: "error",
        code: "missing-ref",
        message: `${label} „${id}" nicht im Kompendium gefunden.`,
        ref: id,
      });
      return null;
    }
    if (entity.kind !== kind) {
      issues.push({
        severity: "error",
        code: "wrong-kind",
        message: `${label} „${id}" ist vom Typ ${entity.kind}, erwartet ${kind}.`,
        ref: id,
      });
      return null;
    }
    return entity as Extract<Entity, { kind: K }>;
  };

  const race = get(character.raceId, "race", "Volk");

  const classes = new Map<string, Extract<Entity, { kind: "class" }>>();
  const classLevelCounts = new Map<string, number>();
  for (const level of character.levels) {
    classLevelCounts.set(level.classId, (classLevelCounts.get(level.classId) ?? 0) + 1);
    if (!classes.has(level.classId)) {
      const entity = get(level.classId, "class", "Klasse");
      if (entity) classes.set(level.classId, entity);
    }
  }

  const feats = character.feats.map((f) => ({
    featId: f.featId,
    choice: f.choice,
    entity: get(f.featId, "feat", "Talent"),
  }));

  const items = character.inventory.map((instance) => ({
    instance,
    entity: instance.itemId ? get(instance.itemId, "item", "Gegenstand") : null,
  }));

  const conditions = character.conditionIds.map((conditionId) => ({
    conditionId,
    entity: get(conditionId, "condition", "Zustand"),
  }));

  // Ein Override-Entity liegt unter eigener UND Ziel-ID in der Map. Gelistet
  // wird nur der kanonische Eintrag (bei Overrides: unter der Ziel-ID).
  const skills: { id: string; entity: Extract<Entity, { kind: "skill" }> }[] = [];
  for (const [id, entity] of compendium) {
    if (entity.kind !== "skill" || entity.deletedAt) continue;
    const canonicalId = entity.overrides ?? entity.id;
    if (id !== canonicalId) continue;
    skills.push({ id, entity });
  }
  skills.sort((a, b) => a.entity.name.localeCompare(b.entity.name));

  return { character, race, classes, classLevelCounts, feats, items, conditions, skills, issues };
}
