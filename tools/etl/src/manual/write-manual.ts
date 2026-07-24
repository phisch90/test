/**
 * Validiert die handkodierten SRD-Daten (Rassen + Zustände) gegen entitySchema
 * und schreibt sie deterministisch (canonicalJson, nach id sortiert) nach
 * packs/srd/races.json und packs/srd/conditions.json.
 *
 *   cd tools/etl && npx tsx src/manual/write-manual.ts
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { canonicalJson, entitySchema, type Entity } from "@codex35/core";
import { CONDITIONS } from "./conditions.js";
import { RACES } from "./races.js";

const here = dirname(fileURLToPath(import.meta.url));
const packsDir = resolve(here, "../../../../packs/srd");

/** Parst jeden Eintrag (füllt Defaults), prüft id-Eindeutigkeit, sortiert nach id. */
function validate(entities: Entity[], label: string, expectedKind: Entity["kind"]): Entity[] {
  const seen = new Set<string>();
  const parsed = entities.map((entity) => {
    const result = entitySchema.safeParse(entity);
    if (!result.success) {
      throw new Error(`${label}: ${entity.id ?? "<ohne id>"}: ${result.error.message}`);
    }
    const e = result.data;
    if (e.kind !== expectedKind) {
      throw new Error(`${label}: ${e.id}: kind "${e.kind}" statt "${expectedKind}"`);
    }
    if (!e.id.startsWith(`srd:${expectedKind}:`)) {
      throw new Error(`${label}: ${e.id}: id folgt nicht der Konvention srd:${expectedKind}:<slug>`);
    }
    if (seen.has(e.id)) throw new Error(`${label}: doppelte id ${e.id}`);
    seen.add(e.id);
    return e;
  });
  return parsed.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

function writePack(fileName: string, entities: Entity[]): void {
  const path = join(packsDir, fileName);
  const json = canonicalJson(entities) + "\n";
  writeFileSync(path, json, "utf8");
  console.log(`${fileName}: ${entities.length} Einträge, ${Buffer.byteLength(json)} Bytes`);
}

mkdirSync(packsDir, { recursive: true });
writePack("races.json", validate(RACES, "races", "race"));
writePack("conditions.json", validate(CONDITIONS, "conditions", "condition"));
