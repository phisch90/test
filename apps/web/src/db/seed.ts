import { entitySchema, type Entity } from "@codex35/core";
import { db } from "./db.js";

/**
 * SRD-Packs liegen als statische JSON-Assets im Build (via import.meta.glob).
 * Beim ersten Start — und wenn srdRev im Build neuer ist als in der DB —
 * werden die unveränderlichen source:'srd'-Zeilen neu eingespielt.
 * Homebrew bleibt unberührt; Links überleben (stabile Slugs).
 */
const packUrls = import.meta.glob("../../../../packs/srd/*.json", {
  query: "?url",
  import: "default",
  eager: true,
}) as Record<string, string>;

const SRD_REV_KEY = "srdRev";

interface Manifest {
  srdRev: number;
  files: string[];
}

function urlFor(basename: string): string | undefined {
  for (const [path, url] of Object.entries(packUrls)) {
    if (path.endsWith(`/${basename}`)) return url;
  }
  return undefined;
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
  return (await response.json()) as T;
}

export type SeedState =
  | { status: "idle" | "seeding" | "done" }
  | { status: "error"; message: string };

export async function ensureSeeded(onProgress?: (msg: string) => void): Promise<void> {
  const manifestUrl = urlFor("manifest.json");
  if (!manifestUrl) {
    // Kein Pack im Build (z.B. ETL noch nicht gelaufen) — App läuft leer weiter.
    console.warn("Kein SRD-Manifest im Build gefunden — Kompendium bleibt leer.");
    return;
  }
  const manifest = await fetchJson<Manifest>(manifestUrl);
  const stored = await db.settings.get(SRD_REV_KEY);
  if (stored && stored.value === manifest.srdRev) return;

  onProgress?.("Lade SRD-Daten…");
  const allEntities: Entity[] = [];
  for (const file of manifest.files) {
    if (!file.endsWith(".json") || file === "manifest.json") continue;
    const url = urlFor(file);
    if (!url) {
      console.warn(`Pack ${file} steht im Manifest, fehlt aber im Build.`);
      continue;
    }
    const raw = await fetchJson<unknown[]>(url);
    for (const item of raw) {
      const parsed = entitySchema.safeParse(item);
      if (parsed.success) allEntities.push(parsed.data);
      else console.error(`Ungültiger SRD-Eintrag in ${file}`, parsed.error.issues[0]);
    }
  }

  onProgress?.("Richte Kompendium ein…");
  await db.transaction("rw", db.entities, db.settings, async () => {
    await db.entities.where("source").equals("srd").delete();
    await db.entities.bulkPut(allEntities);
    await db.settings.put({ key: SRD_REV_KEY, value: manifest.srdRev });
  });
}

/** Persistenten Speicher anfragen (Browser darf sonst IndexedDB räumen). */
export async function requestPersistentStorage(): Promise<boolean> {
  try {
    if (navigator.storage?.persist) {
      const already = await navigator.storage.persisted();
      return already || (await navigator.storage.persist());
    }
  } catch {
    // egal — dann eben nicht persistent; Settings-Seite warnt.
  }
  return false;
}
