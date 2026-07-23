import { useEffect, useState } from "react";
import type { HouseRules } from "@codex35/core";
import { S } from "../strings.js";
import { SettingsRepo } from "../db/repo.js";
import { useHouseRules } from "../lib/hooks.js";
import { buildExport, downloadExport, importEnvelope, type ImportResult } from "../lib/transfer.js";
import { Card, GhostButton, PrimaryButton, SectionTitle } from "../ui/bits.js";

const oglText = Object.values(
  import.meta.glob("../../../../packs/srd/OGL.txt", {
    query: "?raw",
    import: "default",
    eager: true,
  }) as Record<string, string>,
)[0];

export function SettingsPage() {
  const houseRules = useHouseRules();
  const [persisted, setPersisted] = useState<boolean | null>(null);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [showLicense, setShowLicense] = useState(false);

  useEffect(() => {
    navigator.storage
      ?.persisted?.()
      .then(setPersisted)
      .catch(() => setPersisted(null));
  }, []);

  const setRule = (patch: Partial<HouseRules>) =>
    void SettingsRepo.setHouseRules({ ...houseRules, ...patch });

  const onImportFile = async (file: File) => {
    setImportError(null);
    setImportResult(null);
    try {
      const raw: unknown = JSON.parse(await file.text());
      setImportResult(await importEnvelope(raw));
    } catch (error) {
      setImportError(error instanceof Error ? error.message : String(error));
    }
  };

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">{S.nav.settings}</h1>

      <Card>
        <SectionTitle>{S.settings.houseRules}</SectionTitle>
        <Toggle
          label={S.settings.maxHpL1}
          checked={houseRules.maxHpFirstLevel}
          onChange={(v) => setRule({ maxHpFirstLevel: v })}
        />
        <Toggle
          label={S.settings.fractional}
          checked={houseRules.fractionalBabAndSaves}
          onChange={(v) => setRule({ fractionalBabAndSaves: v })}
        />
        <Toggle
          label={S.settings.xpPenalty}
          checked={houseRules.multiclassXpPenalty}
          onChange={(v) => setRule({ multiclassXpPenalty: v })}
        />
      </Card>

      <Card>
        <SectionTitle>{S.settings.exportTitle}</SectionTitle>
        <p className="mb-2 text-xs text-slate-400">{S.settings.dataPrivacy}</p>
        <div className="flex flex-wrap items-center gap-2">
          <PrimaryButton onClick={() => void buildExport().then(downloadExport)}>
            {S.settings.exportAll}
          </PrimaryButton>
          <label className="cursor-pointer rounded-lg border border-slate-600 px-3 py-2 text-sm hover:bg-slate-800">
            {S.settings.importFile}
            <input
              type="file"
              accept="application/json"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void onImportFile(file);
                e.target.value = "";
              }}
            />
          </label>
        </div>
        {importResult && (
          <p className="mt-2 text-xs text-emerald-400">
            Import: {importResult.charactersAdded + importResult.charactersUpdated} Charaktere,{" "}
            {importResult.entitiesAdded + importResult.entitiesUpdated} Homebrew-Einträge übernommen
            ({importResult.charactersSkipped + importResult.entitiesSkipped} übersprungen).
          </p>
        )}
        {importError && <p className="mt-2 text-xs text-red-400">Import fehlgeschlagen: {importError}</p>}
      </Card>

      <Card>
        <SectionTitle>{S.settings.storage}</SectionTitle>
        <p className={`text-sm ${persisted ? "text-emerald-400" : "text-amber-400"}`}>
          {persisted === null ? "…" : persisted ? S.settings.persisted : S.settings.notPersisted}
        </p>
      </Card>

      <Card>
        <SectionTitle>{S.settings.license}</SectionTitle>
        <p className="mb-2 text-xs text-slate-400">
          Das mitgelieferte Kompendium ist Open Game Content aus dem D&D 3.5 System Reference
          Document, genutzt unter der Open Game License v1.0a. Dieses Werk ist inoffiziell und
          weder von Wizards of the Coast noch von Lion's Den unterstützt.
        </p>
        <GhostButton onClick={() => setShowLicense(!showLicense)}>
          {showLicense ? "Lizenztext ausblenden" : "Lizenztext anzeigen"}
        </GhostButton>
        {showLicense && (
          <pre className="mt-2 max-h-96 overflow-y-auto whitespace-pre-wrap rounded bg-slate-950 p-2 text-[10px] leading-snug text-slate-400">
            {oglText ?? "OGL.txt liegt nicht im Build (ETL noch nicht gelaufen)."}
          </pre>
        )}
      </Card>
    </div>
  );
}

function Toggle(props: { label: string; checked: boolean; onChange: (value: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-3 py-1.5">
      <span className="text-sm">{props.label}</span>
      <input
        type="checkbox"
        checked={props.checked}
        onChange={(e) => props.onChange(e.target.checked)}
        className="h-5 w-9 accent-amber-500"
      />
    </label>
  );
}
