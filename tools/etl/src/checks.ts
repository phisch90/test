/**
 * Gemeinsame Stichproben-Assertions für verify.ts und test/packs.test.ts.
 * Läuft gegen die GESCHRIEBENEN Packs (packs/srd), nicht gegen den ETL-Zwischenstand.
 */
import { entitySchema, type Entity } from "@codex35/core";
import { readFileSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
export const PACKS_DIR = resolve(HERE, "../../../packs/srd");

export const MAX_FILE_BYTES = 350_000;

export interface Manifest {
  srdRev: number;
  files: string[];
  counts: Record<string, number>;
}

export function loadManifest(): Manifest {
  return JSON.parse(readFileSync(join(PACKS_DIR, "manifest.json"), "utf8")) as Manifest;
}

/** Alle Entities aus manifest.files laden — jedes einzeln gegen entitySchema validiert. */
export function loadEntities(manifest: Manifest): Map<string, Entity> {
  const map = new Map<string, Entity>();
  for (const file of manifest.files) {
    const raw = JSON.parse(readFileSync(join(PACKS_DIR, file), "utf8")) as unknown[];
    if (!Array.isArray(raw)) throw new Error(`${file}: kein Entity-Array`);
    for (const item of raw) {
      const entity = entitySchema.parse(item);
      if (map.has(entity.id)) throw new Error(`Doppelte ID über Pack-Dateien: ${entity.id}`);
      map.set(entity.id, entity);
    }
  }
  return map;
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`Stichprobe fehlgeschlagen: ${message}`);
}

function get(entities: Map<string, Entity>, id: string): Entity {
  const entity = entities.get(id);
  assert(entity, `${id} fehlt`);
  return entity;
}

/** Stichproben laut Spez — müssen alle halten. */
export function runChecks(manifest: Manifest, entities: Map<string, Entity>): void {
  const byKind = (kind: string): Entity[] => [...entities.values()].filter((e) => e.kind === kind);

  // Counts
  const skills = byKind("skill");
  assert(skills.length === 40, `40 Skills erwartet, ${skills.length} gefunden`);

  // 53 Klassen im Dump − 13 psionische (4 base + 9 prestige) = 40.
  const classes = byKind("class");
  assert(classes.length === 40, `40 nicht-psionische Klassen erwartet, ${classes.length} gefunden`);
  const baseClasses = classes.filter((c) => c.tags.includes("base") && !c.tags.includes("npc"));
  assert(baseClasses.length === 11, `11 PHB-Basisklassen erwartet, ${baseClasses.length} gefunden`);

  // 699 Zeilen im Dump − 3 Duplikate (Genesis, Rage, Undeath to Death) = 696.
  const spells = byKind("spell");
  assert(spells.length === 696, `696 Zauber erwartet (699 Zeilen − 3 Duplikate), ${spells.length} gefunden`);
  // Merge-Probe: Rage steht im Dump doppelt (Domänen- + Klassenkapitel).
  const rage = get(entities, "srd:spell:rage");
  assert(rage.kind === "spell", "rage ist kein Zauber");
  assert(
    rage.data.levels["bard"] === 2 && rage.data.levels["sorcerer-wizard"] === 3 && rage.data.levels["domain-madness"] === 3,
    `Rage levels unvollständig gemerged: ${JSON.stringify(rage.data.levels)}`,
  );

  const feats = byKind("feat");
  assert(
    feats.length === 327,
    `327 nicht-psionische Feats erwartet (387 − 59 psionische − 1 Vorlagenzeile), ${feats.length} gefunden`,
  );

  // Fighter
  const fighter = get(entities, "srd:class:fighter");
  assert(fighter.kind === "class", "fighter ist keine Klasse");
  assert(fighter.data.levels.length === 20, `Fighter: 20 Zeilen erwartet, ${fighter.data.levels.length}`);
  const f20 = fighter.data.levels[19]!;
  assert(f20.bab === 20 && f20.fort === 12 && f20.ref === 6 && f20.will === 6,
    `Fighter Stufe 20: bab/fort/ref/will = ${f20.bab}/${f20.fort}/${f20.ref}/${f20.will}, erwartet 20/12/6/6`);
  const f1Bonus = fighter.data.levels[0]!.features.find((x) => /^bonus feat/i.test(x.name));
  assert(f1Bonus, "Fighter Stufe 1: kein Bonus-feat-Feature");
  assert(
    f1Bonus.effects.some((e) => e.target === "feats.slots" && e.value === 1),
    "Fighter Bonus feat: feats.slots-Effect fehlt",
  );

  // Wizard
  const wizard = get(entities, "srd:class:wizard");
  assert(wizard.kind === "class", "wizard ist keine Klasse");
  const w5 = wizard.data.levels[4]!.spellsPerDay;
  assert(w5 && w5[0] === 4 && w5[1] === 3 && w5[2] === 2 && w5[3] === 1,
    `Wizard Stufe 5 spellsPerDay beginnt ${JSON.stringify(w5?.slice(0, 4))}, erwartet [4,3,2,1]`);
  assert(wizard.data.spellcasting?.ability === "int", "Wizard spellcasting.ability != int");

  // Rogue
  const rogue = get(entities, "srd:class:rogue");
  assert(rogue.kind === "class", "rogue ist keine Klasse");
  const r20 = rogue.data.levels[19]!;
  assert(r20.ref === 12 && r20.bab === 15, `Rogue Stufe 20: ref=${r20.ref}, bab=${r20.bab}, erwartet 12/15`);

  // Fireball
  const fireball = get(entities, "srd:spell:fireball");
  assert(fireball.kind === "spell", "fireball ist kein Zauber");
  assert(fireball.data.school === "Evocation", `Fireball school = ${fireball.data.school}`);
  assert(fireball.data.levels["sorcerer-wizard"] === 3, "Fireball sorcerer-wizard != 3");

  // Power Attack
  const powerAttack = get(entities, "srd:feat:power-attack");
  assert(powerAttack.kind === "feat", "power-attack ist kein Feat");
  assert(
    powerAttack.data.prerequisites.some(
      (p) => p.type === "minAbility" && p.ability === "str" && p.value === 13,
    ),
    "Power Attack: minAbility str 13 fehlt",
  );

  // Move Silently
  const moveSilently = get(entities, "srd:skill:move-silently");
  assert(moveSilently.kind === "skill", "move-silently ist kein Skill");
  assert(moveSilently.data.keyAbility === "dex", "Move Silently keyAbility != dex");
  assert(moveSilently.data.acpApplies === true, "Move Silently acpApplies != true");

  // Longsword (Handprobe: 15 gp, 1d8, 19-20/x2, 4 lb)
  const longsword = get(entities, "srd:item:longsword");
  assert(longsword.kind === "item", "longsword ist kein Item");
  assert(longsword.data.costGp === 15, `Longsword costGp = ${longsword.data.costGp}`);
  assert(longsword.data.weightLb === 4, `Longsword weightLb = ${longsword.data.weightLb}`);
  assert(longsword.data.weapon?.damage === "1d8", `Longsword damage = ${longsword.data.weapon?.damage}`);
  assert(longsword.data.weapon?.critRange === "19-20", `Longsword critRange = ${longsword.data.weapon?.critRange}`);
  assert(longsword.data.weapon?.critMult === "x2", `Longsword critMult = ${longsword.data.weapon?.critMult}`);
  assert(longsword.data.weapon?.category === "martial", `Longsword category = ${longsword.data.weapon?.category}`);

  // Spelllisten laut Konvention vorhanden
  for (const slug of ["sorcerer-wizard", "cleric", "druid", "bard", "paladin", "ranger", "domain-destruction"]) {
    assert(entities.has(`srd:spelllist:${slug}`), `srd:spelllist:${slug} fehlt`);
  }

  // Dateigrößen
  for (const file of manifest.files) {
    const size = statSync(join(PACKS_DIR, file)).size;
    assert(size < MAX_FILE_BYTES, `${file} ist ${size} Bytes (Limit ${MAX_FILE_BYTES})`);
  }

  // Manifest-counts stimmen mit Inhalt überein
  const actualCounts: Record<string, number> = {};
  for (const entity of entities.values()) {
    actualCounts[entity.kind] = (actualCounts[entity.kind] ?? 0) + 1;
  }
  for (const [kind, count] of Object.entries(manifest.counts)) {
    assert(actualCounts[kind] === count, `manifest.counts.${kind}=${count}, tatsächlich ${actualCounts[kind] ?? 0}`);
  }
}
