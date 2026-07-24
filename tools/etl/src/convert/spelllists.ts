import type { SpellEntity, SpellListEntity } from "@codex35/core";
import type { ConvertContext } from "../context.js";
import { requireTable } from "../parse-sql.js";
import { htmlToText, slugify } from "../util.js";

/** Anzeigenamen der Klassenlisten. */
const LIST_NAMES: Record<string, string> = {
  "sorcerer-wizard": "Sorcerer/Wizard Spell List",
  bard: "Bard Spell List",
  cleric: "Cleric Spell List",
  druid: "Druid Spell List",
  paladin: "Paladin Spell List",
  ranger: "Ranger Spell List",
  adept: "Adept Spell List",
  assassin: "Assassin Spell List",
  blackguard: "Blackguard Spell List",
};

/** Prestige-/NPC-Listen, die im Dump (auch) als spell_list_1..5 an der Klasse hängen. */
const CLASS_COLUMN_LISTS = ["Adept", "Assassin", "Blackguard"] as const;

function normalizeSpellName(name: string): string {
  return name.trim().replace(/\*+$/, "").toLowerCase();
}

/**
 * Andargors Domänentabelle nutzt teils 3.0-Namen; das SRD 3.5 benennt sie um
 * (siehe offizielle SRD-Domänenlisten). Bewusst kuratierte Zuordnung:
 */
const SPELL_ALIASES: Record<string, string> = {
  blindness: "blindness/deafness",
  emotion: "heroism", // Charm 4 (3.5)
  "random action": "lesser confusion", // Madness 1 (3.5)
  unbinding: "freedom", // Liberation 9 (3.5)
  symbol: "symbol of death", // Rune 8 (3.5)
};

/**
 * Spelllisten aggregieren: primär aus spell.levels, ergänzt um die
 * spell_list_N-Spalten der Klassen (Assassin/Blackguard/Adept — Grad = N).
 */
export function convertSpellLists(ctx: ConvertContext, spells: SpellEntity[]): SpellListEntity[] {
  const lists = new Map<string, Record<string, number>>();

  const put = (listSlug: string, spellId: string, grade: number) => {
    const list = lists.get(listSlug) ?? {};
    const existing = list[spellId];
    list[spellId] = existing === undefined ? grade : Math.min(existing, grade);
    lists.set(listSlug, list);
  };

  for (const spell of spells) {
    for (const [listSlug, grade] of Object.entries(spell.data.levels)) {
      put(listSlug, spell.id, grade);
    }
  }

  // Klassen-Spaltenlisten (Namenslisten) auflösen.
  const spellIdByName = new Map<string, string>();
  for (const spell of spells) {
    spellIdByName.set(normalizeSpellName(spell.name), spell.id);
  }
  const resolveSpell = (raw: string): string | undefined => {
    // Klammerzusätze abwerfen ("summon monster V (only summons 1d3 shadows)").
    const stripped = raw.replace(/\s*\([^)]*\)\s*/g, " ").replace(/\s+/g, " ");
    let norm = normalizeSpellName(stripped);
    norm = SPELL_ALIASES[norm] ?? norm;
    const direct = spellIdByName.get(norm);
    if (direct) return direct;
    // "greater invisibility" ↔ "Invisibility, Greater"
    const m = /^(greater|lesser|mass) (.+)$/.exec(norm);
    if (m) return spellIdByName.get(`${m[2]}, ${m[1]}`);
    return undefined;
  };

  const classTable = requireTable(ctx.db, "class");
  for (const className of CLASS_COLUMN_LISTS) {
    const row = classTable.rows.find((r) => r.name === className);
    if (!row) continue;
    const listSlug = slugify(className);
    for (let grade = 1; grade <= 5; grade++) {
      const cell = row[`spell_list_${grade}`];
      if (!cell) continue;
      for (const rawName of cell.split(",").map((s) => s.trim()).filter(Boolean)) {
        const spellId = resolveSpell(rawName);
        if (!spellId) {
          ctx.warnings.add(`spelllist ${listSlug}: Zauber "${rawName}" (Grad ${grade}) nicht im spell-Dump — übersprungen`);
          continue;
        }
        put(listSlug, spellId, grade);
      }
    }
  }

  // Domänenlisten aus der domain-Tabelle (spell_1..spell_9) ergänzen — viele
  // Domänenzuordnungen fehlen im level-Text der spell-Tabelle (z.B. Artifice, Charm).
  const domainTable = requireTable(ctx.db, "domain");
  const domainRowByName = new Map(domainTable.rows.map((r) => [slugify(r.name ?? ""), r]));
  for (const row of domainTable.rows) {
    const listSlug = `domain-${slugify(row.name ?? "")}`;
    for (let grade = 1; grade <= 9; grade++) {
      const cell = row[`spell_${grade}`];
      if (!cell || cell.trim() === "") continue;
      // Zelle kann mehrere Zauber enthalten ("magic circle against chaos/evil/good/law" nicht — aber "or"-Fälle).
      const spellId = resolveSpell(cell);
      if (!spellId) {
        ctx.warnings.add(`spelllist ${listSlug}: Domänenzauber "${cell.trim()}" (Grad ${grade}) nicht auflösbar — übersprungen`);
        continue;
      }
      put(listSlug, spellId, grade);
    }
  }

  const out: SpellListEntity[] = [];
  for (const [listSlug, spellMap] of lists) {
    const isDomain = listSlug.startsWith("domain-");
    let name: string;
    let description = "";
    const tags: string[] = [];

    if (isDomain) {
      const domainSlug = listSlug.slice("domain-".length);
      const row = domainRowByName.get(domainSlug);
      name = row?.name ? `${row.name} Domain` : `${domainSlug} Domain`;
      description = htmlToText(row?.full_text ?? row?.granted_powers ?? "");
      tags.push("domain");
    } else {
      name = LIST_NAMES[listSlug] ?? `${listSlug} Spell List`;
      if (!LIST_NAMES[listSlug]) {
        ctx.warnings.add(`spelllist: unerwartete Liste "${listSlug}"`);
      }
      tags.push("class");
    }

    // Deterministisch: Zauber-IDs sortiert einfügen.
    const sorted: Record<string, number> = {};
    for (const key of Object.keys(spellMap).sort()) sorted[key] = spellMap[key]!;

    out.push({
      id: `srd:spelllist:${listSlug}`,
      kind: "spelllist",
      name,
      source: "srd",
      schemaVersion: 1,
      rev: 1,
      updatedAt: "",
      tags,
      description,
      effects: [],
      data: { spells: sorted },
    });
  }

  return out;
}
