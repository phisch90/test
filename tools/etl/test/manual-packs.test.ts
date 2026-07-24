/**
 * Prüft die handkodierten Packs (packs/srd/races.json, packs/srd/conditions.json):
 * jedes Element valide gegen entitySchema, plus inhaltliche Stichproben.
 * Vorher erzeugen mit: npx tsx src/manual/write-manual.ts
 */
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { entitySchema, type Effect, type Entity, type RaceEntity } from "@codex35/core";

const here = dirname(fileURLToPath(import.meta.url));
const packsDir = resolve(here, "../../../packs/srd");

function loadPack(fileName: string): Entity[] {
  const raw = JSON.parse(readFileSync(join(packsDir, fileName), "utf8")) as unknown[];
  expect(Array.isArray(raw)).toBe(true);
  return raw.map((element) => entitySchema.parse(element));
}

const races = loadPack("races.json");
const conditions = loadPack("conditions.json");

function byId(entities: Entity[], id: string): Entity {
  const found = entities.find((e) => e.id === id);
  expect(found, `Eintrag ${id} fehlt`).toBeDefined();
  return found!;
}

/** Alle Effekte einer Rasse: Envelope + Trait-Effekte (wie collectEffects in der Engine). */
function raceEffects(race: RaceEntity): Effect[] {
  return [...race.effects, ...race.data.traits.flatMap((t) => t.effects)];
}

describe("packs/srd/races.json", () => {
  it("enthält genau 7 valide, nach id sortierte Rassen aus dem SRD", () => {
    expect(races).toHaveLength(7);
    expect(races.map((e) => e.id)).toEqual([...races.map((e) => e.id)].sort());
    for (const race of races) {
      expect(race.kind).toBe("race");
      expect(race.source).toBe("srd");
      expect(race.updatedAt).toBe("");
      expect(race.id).toMatch(/^srd:race:[a-z-]+$/);
    }
  });

  it("Dwarf: Con +2 / Cha −2, 20 ft., medium, favored class fighter", () => {
    const dwarf = byId(races, "srd:race:dwarf") as RaceEntity;
    expect(dwarf.data.abilityMods).toEqual({ con: 2, cha: -2 });
    expect(dwarf.data.speedFt).toBe(20);
    expect(dwarf.data.size).toBe("medium");
    expect(dwarf.data.favoredClassId).toBe("srd:class:fighter");
  });

  it("Halfling: small und ein UNBEDINGTER +1-Bonus auf alle Rettungswürfe", () => {
    const halfling = byId(races, "srd:race:halfling") as RaceEntity;
    expect(halfling.data.size).toBe("small");
    const luck = raceEffects(halfling).find(
      (e) => e.target === "save.all" && e.value === 1 && e.condition === undefined,
    );
    expect(luck).toBeDefined();
    // Der Furcht-Bonus bleibt davon getrennt und situativ.
    const fear = raceEffects(halfling).find(
      (e) => e.target === "save.all" && e.value === 2 && e.bonusType === "morale",
    );
    expect(fear?.condition).toBeTruthy();
  });

  it("Human: Bonus-Feat-Slot und +1 Skillpunkt pro Stufe", () => {
    const human = byId(races, "srd:race:human") as RaceEntity;
    const effects = raceEffects(human);
    expect(effects.some((e) => e.target === "feats.slots" && e.value === 1)).toBe(true);
    expect(effects.some((e) => e.target === "skills.pointsPerLevel" && e.value === 1)).toBe(true);
  });

  it("Attributsanpassungen stehen in abilityMods, nie in effects", () => {
    for (const race of races as RaceEntity[]) {
      for (const effect of raceEffects(race)) {
        expect(effect.target.startsWith("ability.")).toBe(false);
      }
    }
  });
});

describe("packs/srd/conditions.json", () => {
  it("enthält mindestens 25 valide Zustände mit deutscher Kurzfassung", () => {
    expect(conditions.length).toBeGreaterThanOrEqual(25);
    expect(conditions.map((e) => e.id)).toEqual([...conditions.map((e) => e.id)].sort());
    for (const condition of conditions) {
      expect(condition.kind).toBe("condition");
      expect(condition.source).toBe("srd");
      expect(condition.id).toMatch(/^srd:condition:[a-z-]+$/);
      if (condition.kind === "condition") {
        expect(condition.data.summary, `${condition.id} ohne summary`).toBeTruthy();
      }
      expect(condition.description, `${condition.id} ohne description`).toBeTruthy();
    }
  });

  it("Shaken: −2 auf Angriffe und Rettungswürfe", () => {
    const shaken = byId(conditions, "srd:condition:shaken");
    expect(
      shaken.effects.some((e) => e.target === "attack.all" && e.value === -2),
    ).toBe(true);
    expect(shaken.effects.some((e) => e.target === "save.all" && e.value === -2)).toBe(true);
  });

  it("Exhausted: ST −6 (und GE −6)", () => {
    const exhausted = byId(conditions, "srd:condition:exhausted");
    expect(
      exhausted.effects.some((e) => e.target === "ability.str" && e.value === -6),
    ).toBe(true);
    expect(
      exhausted.effects.some((e) => e.target === "ability.dex" && e.value === -6),
    ).toBe(true);
  });

  it("rein textliche Zustände tragen keine Effekte", () => {
    for (const slug of ["dazed", "flat-footed", "helpless", "invisible", "petrified"]) {
      const condition = byId(conditions, `srd:condition:${slug}`);
      expect(condition.effects).toEqual([]);
    }
  });
});
