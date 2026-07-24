import type { Effect, FeatEntity } from "@codex35/core";
import type { ConvertContext } from "../context.js";
import { requireTable } from "../parse-sql.js";
import { htmlToText, slugify } from "../util.js";
import { parsePrerequisites, resolveSkillId } from "./prereqs.js";

/**
 * Kuratierte Effects — nur wo die Mechanik eindeutig ist (Phase 1).
 * Alles andere bleibt Text.
 */
const CURATED_EFFECTS: Record<string, Effect[]> = {
  toughness: [{ target: "hp.max", bonusType: "untyped", value: 3, activation: "passive" }],
  "improved-initiative": [{ target: "init", bonusType: "untyped", value: 4, activation: "passive" }],
  "great-fortitude": [{ target: "save.fort", bonusType: "untyped", value: 2, activation: "passive" }],
  "lightning-reflexes": [{ target: "save.ref", bonusType: "untyped", value: 2, activation: "passive" }],
  "iron-will": [{ target: "save.will", bonusType: "untyped", value: 2, activation: "passive" }],
  dodge: [
    {
      target: "ac",
      bonusType: "dodge",
      value: 1,
      condition: "gegen einen gewählten Gegner",
      activation: "passive",
    },
  ],
  "weapon-finesse": [{ target: "flag:weaponFinesse", bonusType: "untyped", value: 1, activation: "passive" }],
  alertness: [
    { target: "skill:srd:skill:listen", bonusType: "untyped", value: 2, activation: "passive" },
    { target: "skill:srd:skill:spot", bonusType: "untyped", value: 2, activation: "passive" },
  ],
};

const SKILL_PAIR_RE = /\+2 bonus on all ([A-Z][a-zA-Z ]*?) checks and ([A-Z][a-zA-Z ]*?) checks/;

export function convertFeats(ctx: ConvertContext): FeatEntity[] {
  const table = requireTable(ctx.db, "feat");
  const out: FeatEntity[] = [];
  const usedSlugs = new Set<string>();

  const rows = [...table.rows].sort((a, b) => Number(a.id) - Number(b.id));
  for (const row of rows) {
    const name = row.name ?? "";
    const type = row.type ?? "General";

    // Wir shippen keine Powers → psionische Feats raus.
    if (/psionic/i.test(type)) continue;
    // Andargor-Artefakt: die Muster-Zeile "Feat Name [Type of Feat]" aus dem SRD-Kapitelkopf.
    if (name === "Feat Name") {
      ctx.warnings.add(`feat: Vorlagen-Zeile "Feat Name" (id ${row.id}) übersprungen`);
      continue;
    }

    const slug = slugify(name);
    if (usedSlugs.has(slug)) {
      ctx.warnings.add(`feat: doppelter Slug ${slug} — Zeile id ${row.id} übersprungen`);
      continue;
    }
    usedSlugs.add(slug);

    const benefit = htmlToText(row.benefit);
    const normalText = htmlToText(row.normal);
    const specialText = htmlToText(row.special);

    let effects: Effect[] = CURATED_EFFECTS[slug] ?? [];
    if (effects.length === 0) {
      // Muster: "+2 bonus on all X checks and Y checks" (Skill-Paar-Feats).
      const m = SKILL_PAIR_RE.exec(benefit.replace(/\*+/g, ""));
      if (m) {
        const a = resolveSkillId(ctx, m[1]!);
        const b = resolveSkillId(ctx, m[2]!);
        if (a && b) {
          effects = [
            { target: `skill:${a}`, bonusType: "untyped", value: 2, activation: "passive" },
            { target: `skill:${b}`, bonusType: "untyped", value: 2, activation: "passive" },
          ];
        } else {
          ctx.warnings.add(`feat ${name}: Skill-Paar "${m[1]}"/"${m[2]}" nicht auflösbar — keine effects`);
        }
      }
    }

    const tags = type
      .split(",")
      .map((t) => slugify(t))
      .filter((t) => t !== "");

    out.push({
      id: `srd:feat:${slug}`,
      kind: "feat",
      name,
      source: "srd",
      schemaVersion: 1,
      rev: 1,
      updatedAt: "",
      tags,
      description: htmlToText(row.full_text),
      effects,
      data: {
        prerequisites: parsePrerequisites(ctx, row.prerequisite),
        featType: type,
        stackable: row.stack === "Yes",
        requiresChoice: row.multiple === "Yes",
        ...(benefit !== "" ? { benefit } : {}),
        ...(normalText !== "" ? { normalText } : {}),
        ...(specialText !== "" ? { specialText } : {}),
      },
    });
  }

  return out;
}
