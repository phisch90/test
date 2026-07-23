import type { ClassEntity, ClassLevelRow, Prerequisite } from "@codex35/core";
import type { ConvertContext } from "../context.js";
import { splitTopLevel } from "../context.js";
import type { Row } from "../parse-sql.js";
import { requireTable } from "../parse-sql.js";
import { htmlToText, parseBonus, parseHitDie, slugify } from "../util.js";
import { parsePrerequisites, resolveFeatId, resolveSkillId } from "./prereqs.js";

/** Die sieben PHB-Caster — nur sie bekommen einen spellcasting-Block. */
const SPELLCASTING: Record<
  string,
  { model: "prepared" | "spontaneous"; ability: "int" | "wis" | "cha"; list: string; armorFailure: boolean }
> = {
  wizard: { model: "prepared", ability: "int", list: "sorcerer-wizard", armorFailure: true },
  sorcerer: { model: "spontaneous", ability: "cha", list: "sorcerer-wizard", armorFailure: true },
  bard: { model: "spontaneous", ability: "cha", list: "bard", armorFailure: true },
  cleric: { model: "prepared", ability: "wis", list: "cleric", armorFailure: false },
  druid: { model: "prepared", ability: "wis", list: "druid", armorFailure: false },
  paladin: { model: "prepared", ability: "wis", list: "paladin", armorFailure: false },
  ranger: { model: "prepared", ability: "wis", list: "ranger", armorFailure: false },
};

/** "3", "3+1" → 3; NULL/"" → null. */
function parseSlot(value: string | null | undefined): number | null {
  if (value == null || value.trim() === "") return null;
  const m = /^(\d+)/.exec(value.trim());
  return m ? parseInt(m[1]!, 10) : null;
}

function convertRequirements(ctx: ConvertContext, row: Row): Prerequisite[] {
  const out: Prerequisite[] = [];

  if (row.req_base_attack_bonus) {
    out.push({ type: "minBab", value: parseBonus(row.req_base_attack_bonus) });
  }
  for (const part of splitTopLevel(row.req_skill ?? "")) {
    const m = /^(.+?)\s+(\d+)\s+ranks?$/i.exec(part.trim());
    const skillId = m ? resolveSkillId(ctx, m[1]!) : undefined;
    if (m && skillId) {
      out.push({ type: "minSkillRanks", skillId, ranks: parseInt(m[2]!, 10) });
    } else {
      out.push({ type: "custom", text: part.trim() });
    }
  }
  for (const col of ["req_feat", "req_epic_feat"] as const) {
    for (const part of splitTopLevel(row[col] ?? "")) {
      const parsed = parsePrerequisites(ctx, part);
      // parsePrerequisites liefert für ein Fragment genau einen Eintrag;
      // Feat-Namen mit Klammerzusatz fallen aufs Basistalent zurück.
      for (const p of parsed) {
        if (p.type === "custom") {
          const featId = resolveFeatId(ctx, p.text);
          out.push(featId ? { type: "hasFeat", featId } : { type: "custom", text: `Feat: ${p.text}` });
        } else {
          out.push(p);
        }
      }
    }
  }
  for (const col of ["req_race", "req_weapon_proficiency", "req_spells", "req_languages", "req_special"] as const) {
    const value = row[col];
    if (value && value.trim() !== "") {
      out.push({ type: "custom", text: value.trim() });
    }
  }
  return out;
}

/** Standard-Progressionen bei Stufe L (PHB): BAB good=L, avg=3L/4, poor=L/2; Save good=2+L/2, poor=L/3. */
function deriveTemplate(maxLevel: number, last: ClassLevelRow): ClassLevelRow["template"] {
  const babGood = maxLevel;
  const babAvg = Math.floor((maxLevel * 3) / 4);
  const babPoor = Math.floor(maxLevel / 2);
  const saveGood = 2 + Math.floor(maxLevel / 2);
  const savePoor = Math.floor(maxLevel / 3);

  const bab = last.bab === babGood ? "good" : last.bab === babAvg ? "average" : last.bab === babPoor ? "poor" : null;
  const fort = last.fort === saveGood ? "good" : last.fort === savePoor ? "poor" : null;
  const ref = last.ref === saveGood ? "good" : last.ref === savePoor ? "poor" : null;
  const will = last.will === saveGood ? "good" : last.will === savePoor ? "poor" : null;

  if (!bab || !fort || !ref || !will) return undefined;
  return { bab, fort, ref, will };
}

function convertClassSkills(ctx: ConvertContext, className: string, raw: string | null | undefined): string[] {
  const out: string[] = [];
  // Dump-Schönheitsfehler: fehlendes Komma nach ")" ("Knowledge (…) Listen").
  const cleaned = (raw ?? "").replace(/\)\s+(?=[A-Z])/g, "), ");
  for (const part of splitTopLevel(cleaned)) {
    const skillId = resolveSkillId(ctx, part);
    if (skillId) {
      if (!out.includes(skillId)) out.push(skillId);
    } else {
      ctx.warnings.add(`class ${className}: Klassenskill "${part}" nicht auflösbar — weggelassen`);
    }
  }
  return out;
}

export function convertClasses(ctx: ConvertContext): ClassEntity[] {
  const classTable = requireTable(ctx.db, "class");
  const levelTable = requireTable(ctx.db, "class_table");

  // Stufenzeilen je Klasse gruppieren (in Dump-Reihenfolge, dann nach Stufe sortiert).
  const rowsByClass = new Map<string, Row[]>();
  for (const row of levelTable.rows) {
    const arr = rowsByClass.get(row.name ?? "") ?? [];
    arr.push(row);
    rowsByClass.set(row.name ?? "", arr);
  }

  const out: ClassEntity[] = [];
  const classRows = [...classTable.rows].sort((a, b) => Number(a.id) - Number(b.id));

  for (const row of classRows) {
    const name = row.name ?? "";
    const type = row.type ?? "";
    // Keine psionischen Klassen — wir shippen keine Powers.
    if (/psionic/i.test(type)) continue;

    const slug = slugify(name);
    const tags = type
      .split(",")
      .map((t) => t.trim().toLowerCase())
      .filter((t) => t !== "");

    const hitDie = parseHitDie(row.hit_die);
    if (hitDie !== 4 && hitDie !== 6 && hitDie !== 8 && hitDie !== 10 && hitDie !== 12) {
      throw new Error(`class ${name}: hit_die "${row.hit_die}" nicht parsebar`);
    }

    // Epische Stufenzeilen raus: liegen in "SRD 3.5 EpicClasses"/"…EpicPrestigeClasses".
    // Rein epische Prestigeklassen (Agent Retriever & Co.) haben NUR Epic-Referenzen —
    // dort sind die Zeilen 1..10 die reguläre Progression und bleiben drin.
    const allRows = rowsByClass.get(name) ?? [];
    const nonEpic = allRows.filter((r) => !(r.reference ?? "").includes("Epic"));
    const kept = (nonEpic.length > 0 ? nonEpic : allRows)
      .filter((r) => parseInt(r.level ?? "0", 10) <= 20)
      .sort((a, b) => parseInt(a.level ?? "0", 10) - parseInt(b.level ?? "0", 10));
    if (kept.length === 0) {
      throw new Error(`class ${name}: keine Stufenzeilen gefunden`);
    }

    // Höchster jemals verfügbarer Zaubergrad (aus den slots_*/known_*-Spalten).
    let maxGrade = -1;
    let hasKnown = false;
    for (const r of kept) {
      for (let g = 0; g <= 9; g++) {
        if (r[`slots_${g}`] != null && r[`slots_${g}`] !== "") maxGrade = Math.max(maxGrade, g);
        if (r[`spells_known_${g}`] != null && r[`spells_known_${g}`] !== "") {
          maxGrade = Math.max(maxGrade, g);
          hasKnown = true;
        }
      }
    }

    const levels: ClassLevelRow[] = kept.map((r) => {
      const features = splitTopLevel((r.special ?? "").replace(/\s+/g, " "))
        .map((f) => f.trim())
        .filter((f) => f !== "")
        .map((featureName) => ({
          name: featureName,
          effects: /^bonus feat/i.test(featureName)
            ? [{ target: "feats.slots" as const, bonusType: "untyped" as const, value: 1, activation: "passive" as const }]
            : [],
        }));

      const level: ClassLevelRow = {
        bab: parseBonus(r.base_attack_bonus),
        fort: parseBonus(r.fort_save),
        ref: parseBonus(r.ref_save),
        will: parseBonus(r.will_save),
        features,
      };
      if (maxGrade >= 0) {
        level.spellsPerDay = Array.from({ length: maxGrade + 1 }, (_, g) => parseSlot(r[`slots_${g}`]));
        if (hasKnown) {
          level.spellsKnown = Array.from({ length: maxGrade + 1 }, (_, g) => parseSlot(r[`spells_known_${g}`]));
        }
      }
      return level;
    });

    const template = deriveTemplate(levels.length, levels[levels.length - 1]!);
    if (template) levels[levels.length - 1]!.template = template;

    const caster = SPELLCASTING[slug];
    const isPrestige = tags.includes("prestige");

    out.push({
      id: `srd:class:${slug}`,
      kind: "class",
      name,
      source: "srd",
      schemaVersion: 1,
      rev: 1,
      updatedAt: "",
      tags,
      description: htmlToText(row.full_text),
      effects: [],
      data: {
        hitDie,
        skillPointsPerLevel: parseInt(row.skill_points ?? "2", 10),
        classSkillIds: convertClassSkills(ctx, name, row.class_skills),
        maxLevel: levels.length,
        requirements: isPrestige ? convertRequirements(ctx, row) : [],
        levels,
        ...(caster
          ? {
              spellcasting: {
                model: caster.model,
                ability: caster.ability,
                spellListId: `srd:spelllist:${caster.list}`,
                bonusSlots: true,
                armorFailure: caster.armorFailure,
              },
            }
          : {}),
        ...(row.proficiencies ? { proficiencies: htmlToText(row.proficiencies) } : {}),
      },
    });
  }

  return out;
}
