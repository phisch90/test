import type { Prerequisite } from "@codex35/core";
import type { ConvertContext } from "../context.js";
import { splitTopLevel } from "../context.js";

const ABILITY_NAMES: Record<string, "str" | "dex" | "con" | "int" | "wis" | "cha"> = {
  str: "str", strength: "str",
  dex: "dex", dexterity: "dex",
  con: "con", constitution: "con",
  int: "int", intelligence: "int",
  wis: "wis", wisdom: "wis",
  cha: "cha", charisma: "cha",
};

const CLASS_LEVEL_RE = /^(barbarian|bard|cleric|druid|fighter|monk|paladin|ranger|rogue|sorcerer|wizard) level (\d+)(?:st|nd|rd|th)?$/i;

/** Tippfehler/Varianten im Dump → kanonischer Skill-Name. */
const SKILL_ALIASES: Record<string, string> = {
  "handle animals": "handle animal",
};

/** Skill-Namen ("Knowledge (arcana)", "Perform (dance)") auf Skill-ID auflösen. */
export function resolveSkillId(ctx: ConvertContext, rawName: string): string | undefined {
  const name = rawName.trim();
  const key = name.toLowerCase();
  const direct = ctx.skillIdByName.get(SKILL_ALIASES[key] ?? key);
  if (direct) return direct;
  // Generisches Pendant: Klammerzusatz abwerfen ("Craft (alchemy)" → "Craft").
  const base = name.replace(/\s*\([^)]*\)\s*/g, " ").replace(/\s+/g, " ").trim().toLowerCase();
  return ctx.skillIdByName.get(SKILL_ALIASES[base] ?? base);
}

/** Feat-Namen auflösen; Klammerzusatz fällt aufs Basistalent zurück ("Spell Focus (Conjuration)" → Spell Focus). */
export function resolveFeatId(ctx: ConvertContext, rawName: string): string | undefined {
  const name = rawName.trim();
  const direct = ctx.featIdByName.get(name.toLowerCase());
  if (direct) return direct;
  const base = name.replace(/\s*\([^)]*\)\s*/g, " ").replace(/\s+/g, " ").trim();
  if (base !== name) return ctx.featIdByName.get(base.toLowerCase());
  return undefined;
}

/** Ein Textfragment ("Str 13", "base attack bonus +4", "Dodge") in die Prerequisite-Union übersetzen. */
export function parsePrerequisiteFragment(ctx: ConvertContext, fragment: string): Prerequisite {
  const text = fragment.trim().replace(/[.;]+$/, "").trim();

  const ability = /^([A-Za-z]+)\s+(\d+)\+?$/.exec(text);
  if (ability) {
    const ab = ABILITY_NAMES[ability[1]!.toLowerCase()];
    if (ab) return { type: "minAbility", ability: ab, value: parseInt(ability[2]!, 10) };
  }

  const bab = /^base attack bonus \+?(\d+)$/i.exec(text);
  if (bab) return { type: "minBab", value: parseInt(bab[1]!, 10) };

  const casterLevel = /^caster level (\d+)(?:st|nd|rd|th)?$/i.exec(text);
  if (casterLevel) return { type: "minCasterLevel", value: parseInt(casterLevel[1]!, 10) };

  const classLevel = CLASS_LEVEL_RE.exec(text);
  if (classLevel) {
    return {
      type: "classLevel",
      classId: `srd:class:${classLevel[1]!.toLowerCase()}`,
      level: parseInt(classLevel[2]!, 10),
    };
  }

  const ranks = /^(.+?)\s+(\d+)\s+ranks?$/i.exec(text);
  if (ranks) {
    const skillId = resolveSkillId(ctx, ranks[1]!);
    if (skillId) return { type: "minSkillRanks", skillId, ranks: parseInt(ranks[2]!, 10) };
  }

  const featId = resolveFeatId(ctx, text);
  if (featId) return { type: "hasFeat", featId };

  return { type: "custom", text };
}

/**
 * Ganze Prerequisite-Zeile parsen. Kommagetrennt, klammer-bewusst;
 * ungematchte Nachbar-Fragmente werden probeweise wieder zusammengefügt
 * (Feat-Namen mit Komma wie "Blindsight, 5-Ft. Radius").
 */
export function parsePrerequisites(ctx: ConvertContext, raw: string | null | undefined): Prerequisite[] {
  if (raw == null) return [];
  const plain = raw.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  if (plain === "" || plain === "-" || plain === "—") return [];

  const fragments = splitTopLevel(plain);
  const out: Prerequisite[] = [];
  for (let i = 0; i < fragments.length; i++) {
    let parsed = parsePrerequisiteFragment(ctx, fragments[i]!);
    if (parsed.type === "custom" && i + 1 < fragments.length) {
      const joined = `${fragments[i]}, ${fragments[i + 1]}`;
      const joinedParsed = parsePrerequisiteFragment(ctx, joined);
      if (joinedParsed.type !== "custom") {
        parsed = joinedParsed;
        i++;
      }
    }
    out.push(parsed);
  }
  return out;
}
