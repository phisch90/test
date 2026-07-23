import type { HouseRules } from "../schema/character.js";
import { fractionalBab, fractionalSave } from "./tables.js";
import type { ResolvedCharacter, TimelineFeature, TimelineResult } from "./internal.js";

/**
 * Stufe 2 — timeline: die geordnete Stufen-Liste ablaufen.
 * RAW-Multiclass: BAB/Saves = Summe der ABSOLUTEN Tabellenwerte je Klasse.
 * Hausregel fractionalBabAndSaves: Brüche über Klassen summieren, einmal runden
 * (nutzt `template`-Metadaten der Zeile; ohne Template zählt der Tabellenwert).
 */
export function buildTimeline(resolved: ResolvedCharacter, houseRules: HouseRules): TimelineResult {
  const { character, classes, classLevelCounts } = resolved;
  const totalLevel = character.levels.length;

  let bab = 0;
  const saves = { fort: 0, ref: 0, will: 0 };
  let fracBab = 0;
  const fracSaves = { fort: 0, ref: 0, will: 0 };

  const features: TimelineFeature[] = [];
  const currentRow: TimelineResult["currentRow"] = new Map();
  const hpRolls: TimelineResult["hpRolls"] = [];

  // TP-Würfe in Timeline-Reihenfolge (für „max auf Stufe 1" zählt die 1. Charakterstufe).
  for (const level of character.levels) {
    const cls = classes.get(level.classId);
    hpRolls.push({ die: cls?.data.hitDie ?? 0, roll: level.hpRoll });
  }

  for (const [classId, count] of classLevelCounts) {
    const cls = classes.get(classId);
    if (!cls) continue; // resolve hat bereits gewarnt; Stufe zählt, Werte fehlen.

    const rows = cls.data.levels;
    const effectiveCount = Math.min(count, rows.length);
    if (count > rows.length) {
      resolved.issues.push({
        severity: "warning",
        code: "class-level-beyond-table",
        message: `${cls.name}: Stufe ${count} übersteigt die Klassentabelle (${rows.length} Zeilen).`,
        ref: classId,
      });
    }
    const row = rows[effectiveCount - 1];
    if (!row) continue;
    currentRow.set(classId, row);

    bab += row.bab;
    saves.fort += row.fort;
    saves.ref += row.ref;
    saves.will += row.will;

    fracBab += row.template?.bab ? fractionalBab(row.template.bab, effectiveCount) : row.bab;
    fracSaves.fort += row.template?.fort ? fractionalSave(row.template.fort, effectiveCount) : row.fort;
    fracSaves.ref += row.template?.ref ? fractionalSave(row.template.ref, effectiveCount) : row.ref;
    fracSaves.will += row.template?.will ? fractionalSave(row.template.will, effectiveCount) : row.will;

    for (let levelIdx = 0; levelIdx < effectiveCount; levelIdx++) {
      const levelRow = rows[levelIdx];
      if (!levelRow) continue;
      levelRow.features.forEach((feature, featureIdx) => {
        features.push({
          classId,
          className: cls.name,
          level: levelIdx + 1,
          name: feature.name,
          description: feature.description,
          effects: feature.effects,
          featureKey: `${classId}#L${levelIdx}.${featureIdx}`,
        });
      });
    }
  }

  if (houseRules.fractionalBabAndSaves) {
    bab = Math.floor(fracBab);
    saves.fort = Math.floor(fracSaves.fort);
    saves.ref = Math.floor(fracSaves.ref);
    saves.will = Math.floor(fracSaves.will);
  }

  return { totalLevel, bab, saves, hpRolls, features, currentRow };
}
