import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { characterSchema, type Character } from "../schema/character.js";
import { entitySchema, resolveCompendium, type Entity } from "../schema/entities.js";
import { deriveSheet } from "./index.js";

/**
 * Golden-Tests gegen die ECHTEN SRD-Packs (packs/srd) — die Referenzwerte
 * stammen aus den PHB-Tabellen bzw. der Excel-Tabelle der Spielgruppe
 * (Druide). SRD-Datenfehler schlagen hier auf, nicht am Spieltisch.
 */
const packsDir = join(dirname(fileURLToPath(import.meta.url)), "../../../../packs/srd");
const manifestPath = join(packsDir, "manifest.json");
const packsAvailable = existsSync(manifestPath);

function loadCompendium(): Map<string, Entity> {
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as { files: string[] };
  const entities: Entity[] = [];
  for (const file of manifest.files) {
    if (!file.endsWith(".json") || file === "manifest.json") continue;
    const raw = JSON.parse(readFileSync(join(packsDir, file), "utf8")) as unknown[];
    for (const item of raw) entities.push(entitySchema.parse(item));
  }
  return resolveCompendium(entities);
}

const C = (raw: unknown): Character => characterSchema.parse(raw);

describe.skipIf(!packsAvailable)("Golden-Tests gegen die SRD-Packs", () => {
  const compendium = packsAvailable ? loadCompendium() : new Map<string, Entity>();

  const get = (id: string): Entity => {
    const entity = compendium.get(id);
    if (!entity) throw new Error(`${id} fehlt im Pack`);
    return entity;
  };

  it("Kern-Entities existieren", () => {
    for (const id of [
      "srd:class:fighter",
      "srd:class:wizard",
      "srd:class:rogue",
      "srd:class:druid",
      "srd:race:human",
      "srd:race:dwarf",
      "srd:race:halfling",
      "srd:skill:climb",
      "srd:skill:move-silently",
      "srd:feat:power-attack",
      "srd:feat:toughness",
      "srd:spell:fireball",
      "srd:condition:shaken",
    ]) {
      expect(compendium.has(id), id).toBe(true);
    }
  });

  it("Fighter-Tabelle (PHB): Stufe 20 = GAB +20, Fort +12, Ref/Will +6", () => {
    const fighter = get("srd:class:fighter");
    if (fighter.kind !== "class") throw new Error("kind");
    expect(fighter.data.hitDie).toBe(10);
    expect(fighter.data.levels).toHaveLength(20);
    const row20 = fighter.data.levels[19]!;
    expect(row20.bab).toBe(20);
    expect(row20.fort).toBe(12);
    expect(row20.ref).toBe(6);
    expect(row20.will).toBe(6);
    // Stufe 1: Bonus-Talent als Slot-Effekt.
    const bonusFeat = fighter.data.levels[0]!.features.find((f) => /bonus feat/i.test(f.name));
    expect(bonusFeat?.effects.some((e) => e.target === "feats.slots")).toBe(true);
  });

  it("Druiden-Tabelle — Referenz: die Excel der Spielgruppe (= PHB)", () => {
    const druid = get("srd:class:druid");
    if (druid.kind !== "class") throw new Error("kind");
    // Stufe 8: +6/+1, Fort +6, Ref +2, Will +6, Zauber 6/4/3/3/2, Wild Shape (Large)
    const row8 = druid.data.levels[7]!;
    expect(row8.bab).toBe(6);
    expect(row8.fort).toBe(6);
    expect(row8.ref).toBe(2);
    expect(row8.will).toBe(6);
    expect(row8.spellsPerDay?.slice(0, 5)).toEqual([6, 4, 3, 3, 2]);
    expect(row8.features.some((f) => /wild shape/i.test(f.name))).toBe(true);
    // Stufe 20: 6/5/5/5/5/5/4/4/4/4 (letzte Zeile der Excel).
    expect(druid.data.levels[19]!.spellsPerDay).toEqual([6, 5, 5, 5, 5, 5, 4, 4, 4, 4]);
    expect(druid.data.spellcasting?.ability).toBe("wis");
  });

  it("Golden-Charakter: Mensch Kämpfer 4 (Kettenhemd, Toughness)", () => {
    const character = C({
      id: "golden-1",
      name: "Regdar",
      raceId: "srd:race:human",
      abilities: { base: { str: 16, dex: 13, con: 14, int: 10, wis: 12, cha: 8 } },
      levels: [
        { classId: "srd:class:fighter", hpRoll: "max" },
        { classId: "srd:class:fighter", hpRoll: 5 },
        { classId: "srd:class:fighter", hpRoll: 6 },
        { classId: "srd:class:fighter", hpRoll: 7 },
      ],
      feats: [{ featId: "srd:feat:toughness" }],
      inventory: [{ id: "a1", itemId: "srd:item:chain-shirt", qty: 1, equipped: true }],
      skillRanks: { "srd:skill:climb": 4 },
    });
    const sheet = deriveSheet(character, compendium);

    expect(sheet.hp.max).toBe(10 + 5 + 6 + 7 + 4 * 2 + 3); // 39
    expect(sheet.bab).toBe(4);
    expect(sheet.saves.fort.total).toBe(4 + 2);
    expect(sheet.saves.ref.total).toBe(1 + 1);
    expect(sheet.saves.will.total).toBe(1 + 1);
    // Kettenhemd +4, GE +1 (MaxGE 4 klemmt nicht).
    expect(sheet.ac.total.total).toBe(15);
    expect(sheet.ac.touch).toBe(11);
    // Mensch: 1 (Basis L1) + 1 (L3) + 1 (Volk) + 1 (Kämpfer-Bonustalent L1)
    //       + 1 (Kämpfer-Bonustalent L2) + 1 (L4) = 6
    expect(sheet.featSlots.available).toBe(6);
    // Climb: 4 Ränge + ST 3 − 2 Rüstungsmalus Kettenhemd.
    const climb = sheet.skills.find((s) => s.skillId === "srd:skill:climb")!;
    expect(climb.total.total).toBe(4 + 3 - 2);
    expect(sheet.issues.filter((i) => i.severity === "error")).toEqual([]);
  });

  it("Golden-Charakter: Ftr4/Rog3 — iterative Angriffe aus Summen-BAB (+6/+1)", () => {
    const character = C({
      id: "golden-2",
      name: "Multiclass",
      raceId: "srd:race:human",
      abilities: { base: { str: 14, dex: 14, con: 12, int: 10, wis: 10, cha: 10 } },
      levels: [
        ...Array.from({ length: 4 }, () => ({ classId: "srd:class:fighter", hpRoll: "avg" as const })),
        ...Array.from({ length: 3 }, () => ({ classId: "srd:class:rogue", hpRoll: "avg" as const })),
      ],
    });
    const sheet = deriveSheet(character, compendium);
    expect(sheet.bab).toBe(6);
    const melee = sheet.attacks.find((a) => a.key === "melee")!;
    expect(melee.bonuses).toEqual([8, 3]);
    expect(sheet.saves.ref.total).toBe(1 + 3 + 2); // Ftr poor(4) + Rog good(3) + GE
  });

  it("Golden-Charakter: Zauberer 5 (IN 16) — Slots 4/3+1/2+1/1+1, SG-Basis 13", () => {
    const character = C({
      id: "golden-3",
      name: "Mialee",
      raceId: "srd:race:elf",
      abilities: { base: { str: 8, dex: 14, con: 12, int: 16, wis: 12, cha: 10 } },
      levels: Array.from({ length: 5 }, () => ({ classId: "srd:class:wizard", hpRoll: "avg" as const })),
    });
    const sheet = deriveSheet(character, compendium);
    const block = sheet.spellcasting.find((b) => b.classId === "srd:class:wizard")!;
    expect(block.slots.map((s) => s.total).slice(0, 4)).toEqual([4, 4, 3, 2]);
    expect(block.dcBase).toBe(13);
    expect(block.casterLevel.total).toBe(5);
    expect(block.spellListId).toBe("srd:spelllist:sorcerer-wizard");
    // Die Liste existiert und enthält Fireball auf Grad 3.
    const list = get("srd:spelllist:sorcerer-wizard");
    if (list.kind !== "spelllist") throw new Error("kind");
    expect(list.data.spells["srd:spell:fireball"]).toBe(3);
  });

  it("Zauber-Daten: Fireball (Evocation, Sor/Wiz 3, Ref halbiert)", () => {
    const fireball = get("srd:spell:fireball");
    if (fireball.kind !== "spell") throw new Error("kind");
    expect(fireball.data.school.toLowerCase()).toContain("evocation");
    expect(fireball.data.levels["sorcerer-wizard"]).toBe(3);
    expect(fireball.description ?? "").not.toBe("");
  });

  it("Waffen-Daten: Longsword 15 gp, 1d8, 19-20/x2, 4 lb", () => {
    const longsword = get("srd:item:longsword");
    if (longsword.kind !== "item") throw new Error("kind");
    expect(longsword.data.costGp).toBe(15);
    expect(longsword.data.weightLb).toBe(4);
    expect(longsword.data.weapon?.damage).toBe("1d8");
    expect(longsword.data.weapon?.critRange).toBe("19-20");
  });
});
