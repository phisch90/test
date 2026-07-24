import { useMemo, useState } from "react";
import { Link, useParams } from "@tanstack/react-router";
import {
  displayName,
  type ClassEntity,
  type Entity,
  type EntityKind,
  type SpellEntity,
} from "@codex35/core";
import { S } from "../strings.js";
import { useAllEntities, useCompendium } from "../lib/hooks.js";
import { Card, Chip, SearchInput, fmtMod } from "../ui/bits.js";

const BROWSABLE: EntityKind[] = ["class", "race", "feat", "spell", "item", "skill", "condition"];

export function CompendiumPage() {
  const params = useParams({ strict: false }) as { kind?: string };
  const kind = (BROWSABLE as string[]).includes(params.kind ?? "") ? (params.kind as EntityKind) : "class";
  const entities = useAllEntities();
  const [query, setQuery] = useState("");
  const [source, setSource] = useState<"all" | "srd" | "homebrew">("all");

  const list = useMemo(() => {
    if (!entities) return undefined;
    const q = query.trim().toLowerCase();
    return entities
      .filter((e) => e.kind === kind && !e.deletedAt)
      .filter((e) => source === "all" || e.source === source)
      .filter(
        (e) =>
          !q ||
          e.name.toLowerCase().includes(q) ||
          (e.localized?.de?.name ?? "").toLowerCase().includes(q),
      )
      .sort((a, b) => a.name.localeCompare(b.name))
      .slice(0, 300);
  }, [entities, kind, query, source]);

  return (
    <div className="space-y-3">
      <h1 className="text-xl font-bold">{S.nav.compendium}</h1>
      <div className="flex flex-wrap gap-2">
        {BROWSABLE.map((k) => (
          <Link key={k} to="/kompendium/$kind" params={{ kind: k }}>
            <Chip active={k === kind}>{S.compendium.kinds[k]}</Chip>
          </Link>
        ))}
      </div>
      <div className="flex gap-2">
        <div className="flex-1">
          <SearchInput value={query} onChange={setQuery} placeholder={S.actions.search} />
        </div>
        <Chip active={source === "srd"} onClick={() => setSource(source === "srd" ? "all" : "srd")}>
          {S.compendium.sourceSrd}
        </Chip>
        <Chip
          active={source === "homebrew"}
          onClick={() => setSource(source === "homebrew" ? "all" : "homebrew")}
        >
          {S.compendium.sourceHomebrew}
        </Chip>
      </div>

      {list === undefined && <p className="text-slate-400">{S.misc.loading}</p>}
      {list?.length === 0 && <p className="py-8 text-center text-slate-400">{S.compendium.empty}</p>}
      <ul className="divide-y divide-slate-800 rounded-xl border border-slate-800 bg-slate-900/50">
        {list?.map((entity) => (
          <li key={entity.id}>
            <Link
              to="/kompendium/$kind/$entityId"
              params={{ kind, entityId: entity.id }}
              className="flex items-baseline justify-between gap-2 px-3 py-2.5 hover:bg-slate-800/60"
            >
              <div className="min-w-0">
                <div className="truncate text-sm font-medium">{displayName(entity)}</div>
                {entity.localized?.de?.name && (
                  <div className="truncate text-xs text-slate-500">{entity.name}</div>
                )}
                {shortInfo(entity) && (
                  <div className="truncate text-xs text-slate-400">{shortInfo(entity)}</div>
                )}
              </div>
              {entity.source === "homebrew" && (
                <span className="shrink-0 rounded bg-emerald-900/60 px-1.5 py-0.5 text-[10px] text-emerald-300">
                  HB
                </span>
              )}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

function shortInfo(entity: Entity): string {
  switch (entity.kind) {
    case "spell": {
      const levels = Object.entries(entity.data.levels)
        .map(([list, level]) => `${list} ${level}`)
        .join(", ");
      return [entity.data.school, levels].filter(Boolean).join(" · ");
    }
    case "class":
      return `W${entity.data.hitDie} · ${entity.data.levels.length} ${S.sheet.level}n`;
    case "item": {
      const bits: string[] = [entity.data.category];
      if (entity.data.costGp !== undefined) bits.push(`${entity.data.costGp} gp`);
      if (entity.data.weightLb) bits.push(`${entity.data.weightLb} lb`);
      return bits.join(" · ");
    }
    case "feat":
      return entity.data.featType;
    case "condition":
      return entity.data.summary ?? "";
    default:
      return "";
  }
}

export function EntityDetailPage() {
  const { entityId } = useParams({ strict: false }) as { entityId: string };
  const compendium = useCompendium();
  const entity = compendium?.get(entityId);

  if (!compendium) return <p className="text-slate-400">{S.misc.loading}</p>;
  if (!entity) return <p className="text-slate-400">{S.compendium.empty}</p>;

  return (
    <div className="space-y-3">
      <div>
        <h1 className="text-xl font-bold">{displayName(entity)}</h1>
        <p className="text-sm text-slate-400">
          {entity.localized?.de?.name ? `${entity.name} · ` : ""}
          {S.compendium.kinds[entity.kind]} ·{" "}
          {entity.source === "srd" ? S.compendium.sourceSrd : S.compendium.sourceHomebrew}
          {entity.sourcePack ? ` · ${entity.sourcePack}` : ""}
        </p>
      </div>

      {entity.kind === "spell" && <SpellHeader entity={entity} />}
      {entity.kind === "class" && <ClassTable entity={entity} />}

      {entity.localized?.de?.summary && (
        <Card className="text-sm text-amber-100/90">{entity.localized.de.summary}</Card>
      )}

      {(entity.localized?.de?.description ?? entity.description) && (
        <Card>
          <div className="whitespace-pre-wrap text-sm leading-relaxed text-slate-200">
            {entity.localized?.de?.description ?? entity.description}
          </div>
        </Card>
      )}

      {entity.effects.length > 0 && (
        <Card>
          <div className="mb-1 text-xs font-semibold uppercase text-slate-400">Effekte</div>
          <ul className="space-y-1 text-sm">
            {entity.effects.map((effect, i) => (
              <li key={i} className="font-mono text-xs">
                {effect.target} {typeof effect.value === "number" ? fmtMod(effect.value) : effect.value}{" "}
                ({effect.bonusType}){effect.condition ? ` — ${effect.condition}` : ""}
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}

function SpellHeader({ entity }: { entity: SpellEntity }) {
  const d = entity.data;
  const rows: [string, string | undefined][] = [
    ["Schule", [d.school, d.subschool].filter(Boolean).join(" ") + (d.descriptors.length ? ` [${d.descriptors.join(", ")}]` : "")],
    ["Grad", Object.entries(d.levels).map(([l, v]) => `${l} ${v}`).join(", ")],
    ["Komponenten", d.components],
    ["Zeitaufwand", d.castingTime],
    ["Reichweite", d.range],
    ["Ziel/Bereich", d.target ?? d.area ?? d.effect],
    ["Dauer", d.duration],
    ["Rettungswurf", d.savingThrow],
    ["Zauberresistenz", d.spellResistance],
  ];
  return (
    <Card>
      <dl className="grid grid-cols-[max-content_1fr] gap-x-3 gap-y-1 text-sm">
        {rows
          .filter(([, value]) => value)
          .map(([label, value]) => (
            <div key={label} className="contents">
              <dt className="text-slate-400">{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
      </dl>
      {d.summary && <p className="mt-2 text-sm italic text-slate-300">{d.summary}</p>}
    </Card>
  );
}

function ClassTable({ entity }: { entity: ClassEntity }) {
  const d = entity.data;
  const maxSpellLevel = Math.max(0, ...d.levels.map((r) => r.spellsPerDay?.length ?? 0));
  return (
    <Card>
      <div className="mb-2 text-sm text-slate-300">
        W{d.hitDie} · {d.skillPointsPerLevel} + IN Fertigkeitspunkte
        {d.spellcasting && ` · Zauber (${d.spellcasting.ability.toUpperCase()})`}
      </div>
      <div className="table-scroll">
        <table className="w-full min-w-[480px] text-xs">
          <thead className="text-slate-400">
            <tr>
              <th className="px-1 py-1 text-left">Stufe</th>
              <th className="px-1 text-left">GAB</th>
              <th className="px-1">Fort</th>
              <th className="px-1">Ref</th>
              <th className="px-1">Will</th>
              <th className="px-1 text-left">Besonderes</th>
              {maxSpellLevel > 0 &&
                Array.from({ length: maxSpellLevel }, (_, i) => (
                  <th key={i} className="px-1">
                    {i}
                  </th>
                ))}
            </tr>
          </thead>
          <tbody>
            {d.levels.map((row, i) => (
              <tr key={i} className="border-t border-slate-800">
                <td className="px-1 py-1">{i + 1}</td>
                <td className="px-1">{fmtMod(row.bab)}</td>
                <td className="px-1 text-center">{fmtMod(row.fort)}</td>
                <td className="px-1 text-center">{fmtMod(row.ref)}</td>
                <td className="px-1 text-center">{fmtMod(row.will)}</td>
                <td className="px-1">{row.features.map((f) => f.name).join(", ")}</td>
                {maxSpellLevel > 0 &&
                  Array.from({ length: maxSpellLevel }, (_, level) => (
                    <td key={level} className="px-1 text-center">
                      {row.spellsPerDay?.[level] ?? "—"}
                    </td>
                  ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
