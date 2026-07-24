import {
  CURRENT_EXPORT_FORMAT_VERSION,
  canonicalJson,
  exportEnvelopeSchema,
  type ExportEnvelope,
} from "@codex35/core";
import { db } from "../db/db.js";
import { SettingsRepo, migrateAndParseCharacter, migrateAndParseEntity } from "../db/repo.js";

/**
 * Export: ein kanonisch sortiertes JSON-Envelope. Homebrew wird immer
 * eingebettet, SRD nie (Slugs lösen beim Empfänger auf).
 */
export async function buildExport(): Promise<string> {
  const characters = (await db.characters.toArray()).filter((c) => !c.deletedAt);
  const homebrewEntities = (await db.entities.where("source").equals("homebrew").toArray()).filter(
    (e) => !e.deletedAt,
  );
  const houseRules = await SettingsRepo.getHouseRules();
  const envelope: ExportEnvelope = {
    formatVersion: CURRENT_EXPORT_FORMAT_VERSION,
    exportedAt: new Date().toISOString(),
    app: "codex35",
    characters,
    homebrewEntities,
    houseRules,
  };
  return canonicalJson(envelope);
}

export function downloadExport(json: string): void {
  const stamp = new Date().toISOString().slice(0, 10);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `codex35-export-${stamp}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

export interface ImportResult {
  charactersAdded: number;
  charactersUpdated: number;
  charactersSkipped: number;
  entitiesAdded: number;
  entitiesUpdated: number;
  entitiesSkipped: number;
}

/**
 * Import: Zod-validiert (Trust Boundary), Migrationen laufen eager.
 * Konfliktregel v1: höhere rev gewinnt, gleiche/ältere wird übersprungen.
 */
export async function importEnvelope(raw: unknown): Promise<ImportResult> {
  const envelope = exportEnvelopeSchema.parse(raw);
  const result: ImportResult = {
    charactersAdded: 0,
    charactersUpdated: 0,
    charactersSkipped: 0,
    entitiesAdded: 0,
    entitiesUpdated: 0,
    entitiesSkipped: 0,
  };

  await db.transaction("rw", db.characters, db.entities, async () => {
    for (const rawCharacter of envelope.characters) {
      const incoming = migrateAndParseCharacter(rawCharacter);
      const existing = await db.characters.get(incoming.id);
      if (!existing) {
        await db.characters.put(incoming);
        result.charactersAdded++;
      } else if (incoming.rev > existing.rev) {
        await db.characters.put(incoming);
        result.charactersUpdated++;
      } else {
        result.charactersSkipped++;
      }
    }
    for (const rawEntity of envelope.homebrewEntities) {
      const incoming = migrateAndParseEntity(rawEntity);
      if (incoming.source !== "homebrew") continue; // SRD kommt nie per Import.
      const existing = await db.entities.get(incoming.id);
      if (!existing) {
        await db.entities.put(incoming);
        result.entitiesAdded++;
      } else if (incoming.rev > existing.rev) {
        await db.entities.put(incoming);
        result.entitiesUpdated++;
      } else {
        result.entitiesSkipped++;
      }
    }
  });

  return result;
}
