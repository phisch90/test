/** Stichproben gegen die geschriebenen Packs. Aufruf: pnpm verify (aus tools/etl/). */
import { loadEntities, loadManifest, runChecks } from "./checks.js";

const manifest = loadManifest();
const entities = loadEntities(manifest);
runChecks(manifest, entities);

const counts = [...entities.values()].reduce<Record<string, number>>((acc, e) => {
  acc[e.kind] = (acc[e.kind] ?? 0) + 1;
  return acc;
}, {});
console.log(`verify OK — ${entities.size} Entities in ${manifest.files.length} Dateien`);
console.log(
  Object.entries(counts)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join(", "),
);
