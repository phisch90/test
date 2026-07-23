/**
 * ETL-Orchestrator: Dump parsen → konvertieren → validieren → Packs schreiben.
 * Aufruf: pnpm build-packs (aus tools/etl/).
 */
import { canonicalJson, entitySchema, type Entity } from "@codex35/core";
import { mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { ConvertContext } from "./context.js";
import { convertClasses } from "./convert/classes.js";
import { convertFeats } from "./convert/feats.js";
import { convertItems } from "./convert/items.js";
import { convertSkills } from "./convert/skills.js";
import { convertSpells } from "./convert/spells.js";
import { convertSpellLists } from "./convert/spelllists.js";
import { parseSqlDump, requireTable } from "./parse-sql.js";
import { slugify, Warnings } from "./util.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const RAW_SQL = resolve(HERE, "../raw/srd-db-v1.3.sql");
const PACKS_DIR = resolve(HERE, "../../../packs/srd");

/** Ziel: Dateien deutlich unter 350 KB halten. */
const CHUNK_LIMIT_BYTES = 300_000;

/** Dateibasis je kind. */
const FILE_BASE: Record<string, string> = {
  class: "classes",
  skill: "skills",
  feat: "feats",
  spell: "spells",
  spelllist: "spelllists",
  item: "items",
};

function buildContext(sql: string): ConvertContext {
  const db = parseSqlDump(sql);
  const skillIdByName = new Map<string, string>();
  const seenSkillSlugs = new Set<string>();
  for (const row of [...requireTable(db, "skill").rows].sort((a, b) => Number(a.id) - Number(b.id))) {
    const name = row.name ?? "";
    let slug = slugify(name);
    if (seenSkillSlugs.has(slug)) slug = `${slug}${row.psionic === "Yes" ? "-psionic" : "-2"}`;
    seenSkillSlugs.add(slug);
    // Erster Eintrag gewinnt die Namensauflösung (Concentration → normale Variante).
    if (!skillIdByName.has(name.toLowerCase())) {
      skillIdByName.set(name.toLowerCase(), `srd:skill:${slug}`);
    }
  }
  const featIdByName = new Map<string, string>();
  for (const row of requireTable(db, "feat").rows) {
    const name = row.name ?? "";
    if (name === "Feat Name") continue;
    if (!featIdByName.has(name.toLowerCase())) {
      featIdByName.set(name.toLowerCase(), `srd:feat:${slugify(name)}`);
    }
  }
  const domainNames = new Set<string>();
  for (const row of requireTable(db, "domain").rows) {
    domainNames.add((row.name ?? "").toLowerCase());
  }
  return { db, skillIdByName, featIdByName, domainNames, warnings: new Warnings() };
}

/** Entities eines kinds in Dateien < CHUNK_LIMIT_BYTES aufteilen (alphabetisch nach id). */
function chunkEntities(entities: Entity[]): Entity[][] {
  const sizes = entities.map((e) => canonicalJson(e).length + 4);
  const total = sizes.reduce((a, b) => a + b, 2);
  if (total <= CHUNK_LIMIT_BYTES) return [entities];

  const chunks: Entity[][] = [];
  let current: Entity[] = [];
  let currentSize = 2;
  entities.forEach((entity, i) => {
    if (current.length > 0 && currentSize + sizes[i]! > CHUNK_LIMIT_BYTES) {
      chunks.push(current);
      current = [];
      currentSize = 2;
    }
    current.push(entity);
    currentSize += sizes[i]!;
  });
  if (current.length > 0) chunks.push(current);
  return chunks;
}

function main(): void {
  console.log(`Lese ${RAW_SQL} …`);
  const sql = readFileSync(RAW_SQL, "utf8");
  const ctx = buildContext(sql);

  console.log("Konvertiere …");
  const skills = convertSkills(ctx);
  const feats = convertFeats(ctx);
  const spells = convertSpells(ctx);
  const spelllists = convertSpellLists(ctx, spells);
  const classes = convertClasses(ctx);
  const items = convertItems(ctx);

  const all: Entity[] = [...skills, ...feats, ...spells, ...spelllists, ...classes, ...items];

  // Validierung: jedes Entity gegen entitySchema; Fehler = Abbruch.
  const validated: Entity[] = [];
  const errors: string[] = [];
  const seenIds = new Set<string>();
  for (const entity of all) {
    if (seenIds.has(entity.id)) {
      errors.push(`${entity.id}: doppelte ID`);
      continue;
    }
    seenIds.add(entity.id);
    const result = entitySchema.safeParse(entity);
    if (result.success) {
      validated.push(result.data);
    } else {
      errors.push(`${entity.id}: ${result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`);
    }
  }
  if (errors.length > 0) {
    console.error(`\nVALIDIERUNG FEHLGESCHLAGEN (${errors.length} Entities):`);
    for (const e of errors.slice(0, 20)) console.error(`  - ${e}`);
    if (errors.length > 20) console.error(`  … und ${errors.length - 20} weitere`);
    process.exit(1);
  }

  // Stabil nach id sortieren, nach kind gruppieren.
  validated.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const byKind = new Map<string, Entity[]>();
  for (const entity of validated) {
    const arr = byKind.get(entity.kind) ?? [];
    arr.push(entity);
    byKind.set(entity.kind, arr);
  }

  mkdirSync(PACKS_DIR, { recursive: true });

  // Alte von uns generierte Dateien entfernen (Chunk-Anzahl kann sich ändern).
  // Fremddateien (races.json, conditions.json, OGL.txt, …) bleiben unangetastet.
  const generatedPattern = /^(classes|skills|feats|spells|spelllists|items)(-\d+)?\.json$/;
  for (const file of readdirSync(PACKS_DIR)) {
    if (generatedPattern.test(file)) rmSync(join(PACKS_DIR, file));
  }

  for (const [kind, entities] of byKind) {
    const base = FILE_BASE[kind];
    if (!base) throw new Error(`Keine Dateibasis für kind ${kind}`);
    const chunks = chunkEntities(entities);
    chunks.forEach((chunk, i) => {
      const fileName = chunks.length === 1 ? `${base}.json` : `${base}-${i + 1}.json`;
      const path = join(PACKS_DIR, fileName);
      writeFileSync(path, `${canonicalJson(chunk)}\n`);
      console.log(`  ${fileName}: ${chunk.length} Entities`);
    });
  }

  // Manifest: alle *.json im Ordner außer manifest.json, alphabetisch;
  // counts über die tatsächlich gelisteten Dateien (inkl. races/conditions, falls vorhanden).
  const files = readdirSync(PACKS_DIR)
    .filter((f) => f.endsWith(".json") && f !== "manifest.json")
    .sort();
  const counts: Record<string, number> = {};
  for (const file of files) {
    const content = JSON.parse(readFileSync(join(PACKS_DIR, file), "utf8")) as { kind: string }[];
    for (const entity of content) {
      counts[entity.kind] = (counts[entity.kind] ?? 0) + 1;
    }
  }
  const sortedCounts: Record<string, number> = {};
  for (const key of Object.keys(counts).sort()) sortedCounts[key] = counts[key]!;

  writeFileSync(
    join(PACKS_DIR, "manifest.json"),
    `${canonicalJson({ srdRev: 1, files, counts: sortedCounts })}\n`,
  );
  console.log(`  manifest.json: ${files.length} Dateien, counts=${JSON.stringify(sortedCounts)}`);

  if (ctx.warnings.items.length > 0) {
    console.log(`\nWarnungen (${ctx.warnings.items.length}):`);
    for (const w of ctx.warnings.items) console.log(`  ! ${w}`);
  }
  console.log("\nFertig.");
}

main();
