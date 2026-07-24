import { describe, expect, it } from "vitest";
import { entitySchema, resolveCompendium, type Entity } from "../schema/entities.js";
import { spellsForList } from "./spells.js";

const E = (raw: unknown): Entity => entitySchema.parse(raw);

const spellA = E({
  id: "s:acid",
  kind: "spell",
  name: "Acid Splash",
  source: "srd",
  data: { levels: { test: 0 } },
});
const spellB = E({
  id: "s:bolt",
  kind: "spell",
  name: "Lightning Bolt",
  source: "srd",
  data: { levels: { test: 3 } },
});
const spellC = E({
  id: "s:charm",
  kind: "spell",
  name: "Charm Person",
  source: "srd",
  data: { levels: { test: 1 } },
});
const list = E({
  id: "l:test",
  kind: "spelllist",
  name: "Test List",
  source: "srd",
  data: { spells: { "s:bolt": 3, "s:acid": 0, "s:charm": 1, "s:missing": 2 } },
});

describe("spellsForList", () => {
  const compendium = resolveCompendium([spellA, spellB, spellC, list]);

  it("sortiert nach Grad, löst Zauber auf, behält fehlende Referenzen", () => {
    const entries = spellsForList(compendium, "l:test");
    expect(entries.map((e) => e.spellId)).toEqual(["s:acid", "s:charm", "s:missing", "s:bolt"]);
    expect(entries[0]?.spell?.name).toBe("Acid Splash");
    expect(entries[2]?.spell).toBeNull();
  });

  it("unbekannte Liste → leer, kein Crash", () => {
    expect(spellsForList(compendium, "l:nope")).toEqual([]);
    expect(spellsForList(compendium, "s:acid")).toEqual([]); // falscher kind
  });
});

describe("spellState-Robustheit (Sparse-Arrays)", () => {
  it("usedSlots mit null-Löchern (JSON-serialisiertes Sparse-Array) parst zu 0", async () => {
    const { characterSchema } = await import("../schema/character.js");
    const parsed = characterSchema.parse({
      id: "c1",
      name: "Test",
      raceId: "r",
      abilities: { base: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 } },
      spellState: { cls: { known: [], prepared: [], usedSlots: [null, null, 1] } },
    });
    expect(parsed.spellState["cls"]?.usedSlots).toEqual([0, 0, 1]);
  });
});
