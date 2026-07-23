/**
 * Validiert die COMMITTETEN Packs: alle Dateien aus manifest.files parsen
 * als Entity-Arrays gegen entitySchema + dieselben Stichproben wie verify.ts.
 * Datenfehler schlagen so in CI auf, ohne das ETL zu re-runnen.
 */
import { entitySchema } from "@codex35/core";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { loadEntities, loadManifest, PACKS_DIR, runChecks } from "../src/checks.js";

describe("packs/srd", () => {
  const manifest = loadManifest();

  it("manifest listet Dateien und counts", () => {
    expect(manifest.srdRev).toBe(1);
    expect(manifest.files.length).toBeGreaterThan(0);
    expect([...manifest.files].sort()).toEqual(manifest.files);
    expect(manifest.files).not.toContain("manifest.json");
  });

  for (const file of manifest.files) {
    it(`${file} validiert gegen entitySchema`, () => {
      const raw = JSON.parse(readFileSync(join(PACKS_DIR, file), "utf8")) as unknown[];
      expect(Array.isArray(raw)).toBe(true);
      for (const item of raw) {
        const result = entitySchema.safeParse(item);
        if (!result.success) {
          const id = (item as { id?: string }).id ?? "<ohne id>";
          throw new Error(`${file} / ${id}: ${result.error.message}`);
        }
      }
    });
  }

  it("Stichproben halten (gleiche Checks wie verify.ts)", () => {
    const entities = loadEntities(manifest);
    expect(() => runChecks(manifest, entities)).not.toThrow();
  });
});
