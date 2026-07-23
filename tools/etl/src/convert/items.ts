import type { ItemEntity } from "@codex35/core";
import type { ConvertContext } from "../context.js";
import { requireTable } from "../parse-sql.js";
import { htmlToText, parseBonus, parseCostGp, parseCritical, parseFeet, parseWeightLb, slugify } from "../util.js";

type WeaponCategory = "simple" | "martial" | "exotic";
type Handedness = "light" | "one" | "two" | "ranged";
type ArmorKind = "light" | "medium" | "heavy" | "shield";

const WEAPON_CATEGORY: Record<string, WeaponCategory> = {
  "Simple Weapons": "simple",
  "Martial Weapons": "martial",
  "Exotic Weapons": "exotic",
};

const HANDEDNESS: Record<string, Handedness> = {
  "Light Melee Weapons": "light",
  "One-Handed Melee Weapons": "one",
  "Two-Handed Melee Weapons": "two",
  "Ranged Weapons": "ranged",
  Ammunition: "ranged",
  "Unarmed Attacks": "light",
};

const ARMOR_KIND: Record<string, ArmorKind> = {
  "Light armor": "light",
  "Medium armor": "medium",
  "Heavy armor": "heavy",
  Shields: "shield",
};

/** Andargor-Kategorie → itemData.category (magische Items). */
const MAGIC_CATEGORY: Record<string, ItemEntity["data"]["category"]> = {
  Scroll: "scroll",
  Wand: "wand",
  Potion: "potion",
  Oil: "potion",
  "Potion, Oil": "potion",
  Ring: "ring",
  Rod: "rod",
  Staff: "staff",
  Wondrous: "wondrous",
  Weapon: "magic",
  Armor: "magic",
  Shield: "magic",
  "Armor, Shield": "magic",
  Cursed: "other",
  Artifact: "other",
};

/** "-"/"—"/leer → undefined. */
function cleanCell(value: string | null | undefined): string | undefined {
  if (value == null) return undefined;
  const t = value.trim();
  if (t === "" || t === "-" || t === "—") return undefined;
  return t;
}

export function convertItems(ctx: ConvertContext): ItemEntity[] {
  const out: ItemEntity[] = [];
  const bySlug = new Map<string, ItemEntity[]>();

  const push = (entity: ItemEntity, qualifier: string, sourceRowId: string) => {
    // Kollisionen deterministisch auflösen: erst Qualifier anhängen, dann Dump-Zeilen-ID.
    const baseSlug = entity.id.slice("srd:item:".length);
    let slug = baseSlug;
    if (bySlug.has(slug) && qualifier !== "") slug = `${baseSlug}-${qualifier}`;
    if (bySlug.has(slug)) slug = `${slug}-${sourceRowId}`;
    if (bySlug.has(slug)) throw new Error(`item: Slug-Kollision nicht auflösbar: ${slug}`);
    if (slug !== baseSlug) {
      ctx.warnings.add(`item: Namenskollision "${entity.name}" → Slug ${slug}`);
      entity.id = `srd:item:${slug}`;
    }
    bySlug.set(slug, [entity]);
    out.push(entity);
  };

  // ---- Profane Ausrüstung (equipment) --------------------------------------
  const equipment = requireTable(ctx.db, "equipment");
  const eqRows = [...equipment.rows].sort((a, b) => Number(a.id) - Number(b.id));
  for (const row of eqRows) {
    const name = row.name ?? "";
    const family = row.family ?? "";
    const category = row.category ?? "";
    const subcategory = row.subcategory ?? "";

    const costGp = parseCostGp(row.cost);
    const weightLb = parseWeightLb(row.weight);
    const description = htmlToText(row.full_text);

    const base: ItemEntity = {
      id: `srd:item:${slugify(name)}`,
      kind: "item",
      name,
      source: "srd",
      schemaVersion: 1,
      rev: 1,
      updatedAt: "",
      tags: ["mundane"],
      ...(description !== "" ? { description } : {}),
      effects: [],
      data: {
        category: "gear",
        ...(costGp !== undefined ? { costGp } : {}),
        ...(weightLb !== undefined ? { weightLb } : {}),
      },
    };

    if (family === "Weapons" && WEAPON_CATEGORY[category] && HANDEDNESS[subcategory]) {
      const crit = parseCritical(cleanCell(row.critical));
      const rangeIncrementFt = parseFeet(cleanCell(row.range_increment));
      const damageType = cleanCell(row.type);
      base.data.category = "weapon";
      base.tags.push("weapon");
      base.data.weapon = {
        damage: cleanCell(row.dmg_m) ?? "—",
        critRange: crit.critRange,
        critMult: crit.critMult,
        ...(damageType ? { damageType: damageType.toLowerCase() } : {}),
        category: WEAPON_CATEGORY[category]!,
        handedness: HANDEDNESS[subcategory]!,
        ...(rangeIncrementFt !== undefined ? { rangeIncrementFt } : {}),
      };
      push(base, slugify(subcategory), String(row.id));
      continue;
    }

    if (family === "Armor and Shields" && ARMOR_KIND[subcategory]) {
      const kind = ARMOR_KIND[subcategory]!;
      const maxDexRaw = cleanCell(row.maximum_dex_bonus);
      const acpRaw = cleanCell(row.armor_check_penalty);
      const acp = acpRaw && /-?\d/.test(acpRaw) ? -Math.abs(parseBonus(acpRaw)) : 0;
      base.data.category = kind === "shield" ? "shield" : "armor";
      base.tags.push(kind === "shield" ? "shield" : "armor");
      base.data.armor = {
        kind,
        acBonus: parseBonus(row.armor_shield_bonus),
        maxDex: maxDexRaw === undefined ? null : parseBonus(maxDexRaw),
        acp,
        asf: parseBonus(row.arcane_spell_failure_chance),
      };
      push(base, slugify(subcategory), String(row.id));
      continue;
    }

    // Rest: Güter & Dienstleistungen. "Extras" (Rüstungs-/Schildstacheln) landen
    // bewusst als gear — sie haben keine eigenen AC-Werte.
    base.data.category = subcategory === "Tools and Skill Kits" ? "tool" : "gear";
    push(base, slugify(subcategory || category || family), String(row.id));
  }

  // ---- Magische Items (item) ------------------------------------------------
  const items = requireTable(ctx.db, "item");
  const itemRows = [...items.rows].sort((a, b) => Number(a.id) - Number(b.id));
  for (const row of itemRows) {
    const name = row.name ?? "";
    const category = row.category ?? "";
    const subcategory = row.subcategory ?? "";

    // Keine psionischen Items — wir shippen keine Powers.
    if (/psionic/i.test(subcategory) || /psionic/i.test(category)) continue;

    const mapped = MAGIC_CATEGORY[category];
    if (mapped === undefined) {
      ctx.warnings.add(`item ${name}: unbekannte Kategorie "${category}" → other`);
    }

    const costGp = parseCostGp(row.price);
    const weightLb = parseWeightLb(row.weight);
    const description = htmlToText(row.full_text);

    const magicParts: string[] = [];
    if (cleanCell(row.aura)) magicParts.push(`Aura: ${row.aura}`);
    if (cleanCell(row.caster_level)) magicParts.push(`CL: ${row.caster_level}`);
    if (cleanCell(row.price)) magicParts.push(`Price: ${row.price}`);
    if (cleanCell(row.cost)) magicParts.push(`Cost: ${row.cost}`);
    if (cleanCell(row.prereq)) magicParts.push(`Prerequisites: ${row.prereq}`);

    const tags = ["magic"];
    for (const part of subcategory.split(",").map((s) => slugify(s)).filter(Boolean)) {
      if (!tags.includes(part)) tags.push(part);
    }
    if (category === "Cursed") tags.push("cursed");
    if (category === "Artifact") tags.push("artifact");
    if (row.special_ability === "Yes") tags.push("special-ability");

    const entity: ItemEntity = {
      id: `srd:item:${slugify(name)}`,
      kind: "item",
      name,
      source: "srd",
      schemaVersion: 1,
      rev: 1,
      updatedAt: "",
      tags,
      ...(description !== "" ? { description } : {}),
      effects: [],
      data: {
        category: mapped ?? "other",
        ...(costGp !== undefined ? { costGp } : {}),
        ...(weightLb !== undefined ? { weightLb } : {}),
        ...(magicParts.length > 0 ? { magicText: magicParts.join("; ") } : {}),
      },
    };
    push(entity, slugify(`${category} ${subcategory}`), String(row.id));
  }

  return out;
}
