import type { Ability } from "../schema/common.js";
import type { Prerequisite } from "../schema/entities.js";
import type { ResolvedCharacter, TimelineResult } from "./internal.js";
import type { DerivedSheet } from "./types.js";

const ABILITY_LABEL: Record<Ability, string> = {
  str: "ST",
  dex: "GE",
  con: "KO",
  int: "IN",
  wis: "WE",
  cha: "CH",
};

/**
 * Stufe 7 — validate: WARNUNGEN, nie Blocker. Der DM hat Recht (Homebrew-first);
 * jede Warnung ist in der UI pro Charakter stummschaltbar.
 */
export function validate(
  resolved: ResolvedCharacter,
  timeline: TimelineResult,
  sheet: DerivedSheet,
): void {
  const { character } = resolved;
  const issues = sheet.issues;

  // Maximale Ränge je Fertigkeit.
  for (const skill of sheet.skills) {
    if (skill.ranks > skill.maxRanks) {
      issues.push({
        severity: "warning",
        code: "max-ranks",
        message: `${skill.name}: ${skill.ranks} Ränge übersteigen das Maximum von ${skill.maxRanks}${skill.isClassSkill ? "" : " (klassenfremd)"}.`,
        ref: skill.skillId,
      });
    }
  }

  // Fertigkeitspunkte gesamt.
  if (sheet.skillPoints.spent > sheet.skillPoints.available) {
    issues.push({
      severity: "warning",
      code: "skill-points-overspent",
      message: `Fertigkeitspunkte: ${sheet.skillPoints.spent} ausgegeben, nur ${sheet.skillPoints.available} verfügbar.`,
    });
  }

  // Talent-Slots.
  if (sheet.featSlots.used > sheet.featSlots.available) {
    issues.push({
      severity: "warning",
      code: "feat-slots-overspent",
      message: `Talente: ${sheet.featSlots.used} gewählt, nur ${sheet.featSlots.available} Slots verfügbar.`,
    });
  }

  // Talent-Voraussetzungen (gegen den aktuellen Stand — warn-only).
  const featIds = new Set(character.feats.map((f) => f.featId));
  const ranksOf = (skillId: string) => character.skillRanks[skillId] ?? 0;
  const maxCasterLevel = Math.max(0, ...sheet.spellcasting.map((s) => s.casterLevel.total));
  const classLevelOf = (classId: string) => resolved.classLevelCounts.get(classId) ?? 0;

  const unmet = (p: Prerequisite): string | null => {
    switch (p.type) {
      case "minAbility":
        return sheet.abilities[p.ability].score.total >= p.value
          ? null
          : `${ABILITY_LABEL[p.ability]} ${p.value}`;
      case "minBab":
        return timeline.bab >= p.value ? null : `GAB +${p.value}`;
      case "hasFeat":
        return featIds.has(p.featId) ? null : `Talent ${p.featId}`;
      case "minSkillRanks":
        return ranksOf(p.skillId) >= p.ranks ? null : `${p.ranks} Ränge in ${p.skillId}`;
      case "minCasterLevel":
        return maxCasterLevel >= p.value ? null : `Zauberstufe ${p.value}`;
      case "classLevel":
        return classLevelOf(p.classId) >= p.level ? null : `${p.classId} Stufe ${p.level}`;
      case "custom":
        return null; // Nur Anzeige — nie maschinell geprüft.
    }
  };

  for (const feat of resolved.feats) {
    if (!feat.entity) continue;
    for (const p of feat.entity.data.prerequisites) {
      const missing = unmet(p);
      if (missing) {
        issues.push({
          severity: "warning",
          code: "feat-prerequisite",
          message: `${feat.entity.name}: Voraussetzung nicht erfüllt (${missing}).`,
          ref: feat.entity.id,
        });
      }
    }
  }

  // TP-Würfe plausibel?
  character.levels.forEach((level, i) => {
    const cls = resolved.classes.get(level.classId);
    if (!cls || typeof level.hpRoll !== "number") return;
    if (level.hpRoll < 1 || level.hpRoll > cls.data.hitDie) {
      issues.push({
        severity: "warning",
        code: "hp-roll-out-of-range",
        message: `Stufe ${i + 1}: TP-Wurf ${level.hpRoll} liegt außerhalb von 1–${cls.data.hitDie} (W${cls.data.hitDie}).`,
      });
    }
  });

  // Mehr vorbereitete Zauber als Slots (je Grad).
  for (const block of sheet.spellcasting) {
    const prepared = character.spellState[block.classId]?.prepared ?? [];
    const countByLevel = new Map<number, number>();
    for (const p of prepared) {
      countByLevel.set(p.slotLevel, (countByLevel.get(p.slotLevel) ?? 0) + 1);
    }
    for (const slot of block.slots) {
      const count = countByLevel.get(slot.level) ?? 0;
      if (slot.total !== null && count > slot.total) {
        issues.push({
          severity: "warning",
          code: "prepared-over-slots",
          message: `${block.className}: ${count} Zauber Grad ${slot.level} vorbereitet, nur ${slot.total} Slots.`,
          ref: block.classId,
        });
      }
    }
  }
}
