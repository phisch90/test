import type { SpellEntity } from "@codex35/core";
import type { ConvertContext } from "../context.js";
import { splitTopLevel } from "../context.js";
import { requireTable } from "../parse-sql.js";
import { htmlToText, slugify } from "../util.js";

/** Klassenlisten im level-Feld → Listen-Slug (Sorcerer/Wizard teilen sich eine Liste). */
const CLASS_LIST_SLUGS: Record<string, string> = {
  "sorcerer/wizard": "sorcerer-wizard",
  sorcerer: "sorcerer-wizard",
  wizard: "sorcerer-wizard",
  wiz: "sorcerer-wizard",
  sor: "sorcerer-wizard",
  "sor/wiz": "sorcerer-wizard",
  bard: "bard",
  brd: "bard",
  cleric: "cleric",
  clr: "cleric",
  druid: "druid",
  drd: "druid",
  paladin: "paladin",
  pal: "paladin",
  ranger: "ranger",
  rgr: "ranger",
  adept: "adept",
  adp: "adept",
  assassin: "assassin",
  asn: "assassin",
  blackguard: "blackguard",
  blk: "blackguard",
};

/** "Brd 2, Sor/Wiz 2, Destruction 4" → { bard:2, "sorcerer-wizard":2, "domain-destruction":4 }. */
export function parseSpellLevels(
  ctx: ConvertContext,
  levelText: string | null | undefined,
  spellName: string,
): Record<string, number> {
  const levels: Record<string, number> = {};
  if (levelText == null || levelText.trim() === "") return levels;

  for (const part of splitTopLevel(levelText)) {
    const m = /^(.+?)\s+(\d+)$/.exec(part.trim());
    if (!m) {
      ctx.warnings.add(`spell ${spellName}: level-Teil nicht parsebar: "${part}"`);
      continue;
    }
    const listName = m[1]!.trim();
    const grade = parseInt(m[2]!, 10);
    const key = listName.toLowerCase();

    let listSlug: string;
    if (CLASS_LIST_SLUGS[key]) {
      listSlug = CLASS_LIST_SLUGS[key];
    } else if (ctx.domainNames.has(key)) {
      listSlug = `domain-${slugify(listName)}`;
    } else {
      ctx.warnings.add(`spell ${spellName}: unbekannte Liste "${listName}" → Slug ${slugify(listName)}`);
      listSlug = slugify(listName);
    }
    // Bei doppelten Einträgen (Sor UND Wiz) gewinnt der niedrigere Grad.
    const existing = levels[listSlug];
    levels[listSlug] = existing === undefined ? grade : Math.min(existing, grade);
  }
  return levels;
}

export function convertSpells(ctx: ConvertContext): SpellEntity[] {
  const table = requireTable(ctx.db, "spell");
  const out: SpellEntity[] = [];
  const bySlug = new Map<string, SpellEntity>();

  const rows = [...table.rows].sort((a, b) => Number(a.id) - Number(b.id));
  for (const row of rows) {
    const name = row.name ?? "";
    const slug = slugify(name);

    // Andargor listet ein paar Zauber doppelt (Domänen- und Klassenkapitel).
    // Duplikate werden gemerged: Grade vereinigen, längere Beschreibung gewinnt.
    const existing = bySlug.get(slug);
    if (existing) {
      const extraLevels = parseSpellLevels(ctx, row.level, name);
      for (const [list, grade] of Object.entries(extraLevels)) {
        const prev = existing.data.levels[list];
        existing.data.levels[list] = prev === undefined ? grade : Math.min(prev, grade);
      }
      if (Object.keys(existing.data.levels).length > 0) {
        existing.tags = existing.tags.filter((t) => t !== "epic");
      }
      const extraDescription = htmlToText(row.description) || htmlToText(row.full_text);
      if (extraDescription.length > (existing.description ?? "").length) {
        existing.description = extraDescription;
      }
      ctx.warnings.add(`spell: Duplikat "${name}" (id ${row.id}) gemerged — levels jetzt ${JSON.stringify(existing.data.levels)}`);
      continue;
    }

    const levels = parseSpellLevels(ctx, row.level, name);
    const isEpic = Object.keys(levels).length === 0;

    const descriptors = (row.descriptor ?? "")
      .split(",")
      .map((d) => d.trim())
      .filter((d) => d !== "");

    const description = htmlToText(row.description) || htmlToText(row.full_text);
    const summary = htmlToText(row.short_description);
    const materialText = [htmlToText(row.material_components), htmlToText(row.arcane_material_components)]
      .filter((t) => t !== "")
      .join(" Arcane: ");
    const focusText = htmlToText(row.focus);
    const xpCost = htmlToText(row.xp_cost);

    const entity: SpellEntity = {
      id: `srd:spell:${slug}`,
      kind: "spell",
      name,
      source: "srd",
      schemaVersion: 1,
      rev: 1,
      updatedAt: "",
      tags: isEpic ? ["epic"] : [],
      description,
      effects: [],
      data: {
        school: row.school ?? "",
        ...(row.subschool ? { subschool: row.subschool } : {}),
        descriptors,
        levels,
        ...(row.components ? { components: row.components } : {}),
        ...(row.casting_time ? { castingTime: row.casting_time } : {}),
        ...(row.range ? { range: row.range } : {}),
        ...(row.target ? { target: row.target } : {}),
        ...(row.area ? { area: row.area } : {}),
        ...(row.effect ? { effect: row.effect } : {}),
        ...(row.duration ? { duration: row.duration } : {}),
        ...(row.saving_throw ? { savingThrow: row.saving_throw } : {}),
        ...(row.spell_resistance ? { spellResistance: row.spell_resistance } : {}),
        ...(materialText !== "" ? { materialText } : {}),
        ...(focusText !== "" ? { focusText } : {}),
        ...(xpCost !== "" ? { xpCost } : {}),
        ...(summary !== "" ? { summary } : {}),
      },
    };
    bySlug.set(slug, entity);
    out.push(entity);
  }

  return out;
}
