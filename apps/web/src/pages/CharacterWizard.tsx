import { useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  ABILITIES,
  characterSchema,
  deriveSheet,
  displayName,
  maxRanks,
  type Ability,
  type Character,
  type Entity,
} from "@codex35/core";
import { S } from "../strings.js";
import { CharacterRepo } from "../db/repo.js";
import { useAllEntities, useCompendium, useHouseRules } from "../lib/hooks.js";
import { Card, Chip, GhostButton, PrimaryButton, SearchInput, fmtMod } from "../ui/bits.js";

interface Draft {
  name: string;
  playerName: string;
  raceId: string | null;
  base: Record<Ability, number>;
  classId: string | null;
  skillRanks: Record<string, number>;
  featIds: { featId: string; choice?: string }[];
  inventory: { id: string; itemId: string; qty: number; equipped: boolean }[];
}

const INITIAL: Draft = {
  name: "",
  playerName: "",
  raceId: null,
  base: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
  classId: null,
  skillRanks: {},
  featIds: [],
  inventory: [],
};

/** Entwurf → valider Charakter (Stufe 1, TP max) für Live-Ableitung + Anlage. */
function draftToCharacter(draft: Draft): Character {
  return characterSchema.parse({
    id: "draft",
    name: draft.name || "Unbenannt",
    playerName: draft.playerName || undefined,
    raceId: draft.raceId ?? "",
    abilities: { base: draft.base },
    levels: draft.classId ? [{ classId: draft.classId, hpRoll: "max" }] : [],
    skillRanks: draft.skillRanks,
    feats: draft.featIds,
    inventory: draft.inventory,
  });
}

export function CharacterWizardPage() {
  const navigate = useNavigate();
  const entities = useAllEntities();
  const compendium = useCompendium();
  const houseRules = useHouseRules();
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<Draft>(INITIAL);

  const sheet = useMemo(() => {
    if (!compendium || !draft.raceId || !draft.classId) return undefined;
    return deriveSheet(draftToCharacter(draft), compendium, houseRules);
  }, [compendium, draft, houseRules]);

  if (!entities || !compendium) return <p className="text-slate-400">{S.misc.loading}</p>;

  const races = entities.filter((e) => e.kind === "race" && !e.deletedAt);
  const classes = entities
    .filter((e) => e.kind === "class" && !e.deletedAt)
    .filter((e) => e.source === "homebrew" || e.tags.includes("base"));

  const canNext = () => {
    switch (step) {
      case 0:
        return draft.raceId !== null;
      case 2:
        return draft.classId !== null;
      case 6:
        return draft.name.trim().length > 0;
      default:
        return true;
    }
  };

  const finish = async () => {
    const data = draftToCharacter(draft);
    const { id: _drop, ...rest } = data;
    const created = await CharacterRepo.create(rest);
    void navigate({ to: "/charaktere/$charId", params: { charId: created.id } });
  };

  return (
    <div className="space-y-3">
      <h1 className="text-xl font-bold">{S.wizard.title}</h1>
      <div className="flex flex-wrap gap-1">
        {S.wizard.steps.map((label, i) => (
          <Chip key={label} active={i === step} onClick={() => i < step && setStep(i)}>
            {i + 1}. {label}
          </Chip>
        ))}
      </div>

      {step === 0 && (
        <PickList
          items={races}
          selectedId={draft.raceId}
          onSelect={(id) => setDraft({ ...draft, raceId: id })}
          detail={(race) =>
            race.kind === "race"
              ? `${race.data.size} · ${race.data.speedFt} ft.` +
                Object.entries(race.data.abilityMods)
                  .map(([a, v]) => ` · ${S.abilities[a]} ${fmtMod(v ?? 0)}`)
                  .join("")
              : ""
          }
        />
      )}

      {step === 1 && (
        <Card>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {ABILITIES.map((ability) => (
              <label key={ability} className="flex flex-col gap-1">
                <span className="text-xs uppercase text-slate-400">
                  {S.abilityNames[ability]} ({S.abilities[ability]})
                </span>
                <input
                  type="number"
                  min={1}
                  max={30}
                  value={draft.base[ability]}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      base: { ...draft.base, [ability]: e.target.valueAsNumber || 10 },
                    })
                  }
                  className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-lg font-semibold"
                />
                {sheet && (
                  <span className="text-xs text-slate-400">
                    final {sheet.abilities[ability].score.total} ({fmtMod(sheet.abilities[ability].mod)})
                  </span>
                )}
              </label>
            ))}
          </div>
          <p className="mt-2 text-xs text-slate-500">
            Würfelt wie gewohnt am Tisch und tragt die Werte ein — Volks-Modifikatoren rechnet die
            App selbst dazu.
          </p>
        </Card>
      )}

      {step === 2 && (
        <PickList
          items={classes}
          selectedId={draft.classId}
          onSelect={(id) => setDraft({ ...draft, classId: id })}
          detail={(cls) =>
            cls.kind === "class"
              ? `W${cls.data.hitDie} · ${cls.data.skillPointsPerLevel}+IN Punkte${cls.data.spellcasting ? " · Zauberer" : ""}`
              : ""
          }
        />
      )}

      {step === 3 && (
        <SkillStep draft={draft} setDraft={setDraft} entities={entities} sheetPoints={sheet?.skillPoints} classId={draft.classId} compendium={compendium} />
      )}

      {step === 4 && (
        <FeatStep draft={draft} setDraft={setDraft} entities={entities} slots={sheet?.featSlots} />
      )}

      {step === 5 && <GearStep draft={draft} setDraft={setDraft} entities={entities} />}

      {step === 6 && (
        <Card className="space-y-3">
          <label className="block">
            <span className="text-xs uppercase text-slate-400">{S.wizard.name}</span>
            <input
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2"
            />
          </label>
          <label className="block">
            <span className="text-xs uppercase text-slate-400">{S.wizard.playerName}</span>
            <input
              value={draft.playerName}
              onChange={(e) => setDraft({ ...draft, playerName: e.target.value })}
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2"
            />
          </label>
          {sheet && (
            <div className="rounded-lg bg-slate-800/60 p-3 text-sm">
              <div>
                {S.sheet.hp} {sheet.hp.max} · {S.sheet.ac} {sheet.ac.total.total} · {S.sheet.init}{" "}
                {fmtMod(sheet.init.total)}
              </div>
              {sheet.issues.length > 0 && (
                <ul className="mt-2 list-inside list-disc text-xs text-amber-400">
                  {sheet.issues.map((issue, i) => (
                    <li key={i}>{issue.message}</li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </Card>
      )}

      <div className="flex justify-between">
        <GhostButton onClick={() => (step === 0 ? void navigate({ to: "/" }) : setStep(step - 1))}>
          {S.actions.back}
        </GhostButton>
        {step < S.wizard.steps.length - 1 ? (
          <PrimaryButton disabled={!canNext()} onClick={() => setStep(step + 1)}>
            {S.actions.next}
          </PrimaryButton>
        ) : (
          <PrimaryButton disabled={!canNext()} onClick={() => void finish()}>
            {S.actions.create}
          </PrimaryButton>
        )}
      </div>
    </div>
  );
}

function PickList(props: {
  items: Entity[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  detail: (entity: Entity) => string;
}) {
  return (
    <ul className="space-y-2">
      {props.items.length === 0 && (
        <p className="py-6 text-center text-sm text-slate-400">{S.compendium.empty}</p>
      )}
      {props.items.map((entity) => (
        <li key={entity.id}>
          <button
            onClick={() => props.onSelect(entity.id)}
            className={`w-full rounded-xl border p-3 text-left ${
              props.selectedId === entity.id
                ? "border-amber-500 bg-amber-600/10"
                : "border-slate-700 bg-slate-900/60 hover:border-slate-500"
            }`}
          >
            <div className="font-semibold">{displayName(entity)}</div>
            <div className="text-xs text-slate-400">{props.detail(entity)}</div>
          </button>
        </li>
      ))}
    </ul>
  );
}

function SkillStep(props: {
  draft: Draft;
  setDraft: (d: Draft) => void;
  entities: Entity[];
  sheetPoints: { available: number; spent: number } | undefined;
  classId: string | null;
  compendium: Map<string, Entity>;
}) {
  const { draft, setDraft } = props;
  const cls = props.classId ? props.compendium.get(props.classId) : undefined;
  const classSkillIds = new Set(cls?.kind === "class" ? cls.data.classSkillIds : []);
  const skills = props.entities
    .filter((e) => e.kind === "skill" && !e.deletedAt)
    .sort((a, b) => a.name.localeCompare(b.name));
  const left = props.sheetPoints ? props.sheetPoints.available - props.sheetPoints.spent : 0;

  const setRanks = (skillId: string, ranks: number) => {
    const skillRanks = { ...draft.skillRanks };
    if (ranks <= 0) delete skillRanks[skillId];
    else skillRanks[skillId] = ranks;
    setDraft({ ...draft, skillRanks });
  };

  return (
    <Card>
      <div className={`mb-2 text-sm font-semibold ${left < 0 ? "text-red-400" : "text-emerald-400"}`}>
        {S.wizard.pointsLeft}: {left}
      </div>
      <ul className="divide-y divide-slate-800">
        {skills.map((skill) => {
          const isClass = classSkillIds.has(skill.id);
          const ranks = draft.skillRanks[skill.id] ?? 0;
          const max = maxRanks(1, isClass);
          return (
            <li key={skill.id} className="flex items-center justify-between gap-2 py-1.5 text-sm">
              <span className={isClass ? "" : "text-slate-400"}>
                {displayName(skill)}
                {isClass && <span className="ml-1 text-[10px] text-amber-400">●</span>}
                <span className="ml-1 text-xs text-slate-500">
                  {S.sheet.maxRanks} {max}
                </span>
              </span>
              <span className="flex items-center gap-2">
                <GhostButton onClick={() => setRanks(skill.id, ranks - (isClass ? 1 : 0.5))} disabled={ranks <= 0}>
                  −
                </GhostButton>
                <span className="w-8 text-center font-mono">{ranks}</span>
                <GhostButton
                  onClick={() => setRanks(skill.id, ranks + (isClass ? 1 : 0.5))}
                  disabled={ranks >= max || left <= 0}
                >
                  +
                </GhostButton>
              </span>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

function FeatStep(props: {
  draft: Draft;
  setDraft: (d: Draft) => void;
  entities: Entity[];
  slots: { available: number; used: number } | undefined;
}) {
  const { draft, setDraft } = props;
  const [query, setQuery] = useState("");
  const chosen = new Set(draft.featIds.map((f) => f.featId));
  const q = query.trim().toLowerCase();
  const feats = props.entities
    .filter((e) => e.kind === "feat" && !e.deletedAt)
    .filter((e) => !q || e.name.toLowerCase().includes(q))
    .sort((a, b) => a.name.localeCompare(b.name))
    .slice(0, 60);
  const left = props.slots ? props.slots.available - props.slots.used : 0;

  return (
    <Card className="space-y-2">
      <div className={`text-sm font-semibold ${left < 0 ? "text-red-400" : "text-emerald-400"}`}>
        {S.wizard.slotsLeft}: {left}
      </div>
      <SearchInput value={query} onChange={setQuery} placeholder={S.actions.search} />
      <ul className="divide-y divide-slate-800">
        {feats.map((feat) => (
          <li key={feat.id} className="flex items-center justify-between gap-2 py-1.5 text-sm">
            <div className="min-w-0">
              <div className="truncate">{displayName(feat)}</div>
              {feat.kind === "feat" && feat.data.benefit && (
                <div className="truncate text-xs text-slate-500">{feat.data.benefit}</div>
              )}
            </div>
            {chosen.has(feat.id) ? (
              <GhostButton
                danger
                onClick={() =>
                  setDraft({ ...draft, featIds: draft.featIds.filter((f) => f.featId !== feat.id) })
                }
              >
                {S.actions.remove}
              </GhostButton>
            ) : (
              <GhostButton
                onClick={() => setDraft({ ...draft, featIds: [...draft.featIds, { featId: feat.id }] })}
              >
                {S.actions.add}
              </GhostButton>
            )}
          </li>
        ))}
      </ul>
    </Card>
  );
}

function GearStep(props: { draft: Draft; setDraft: (d: Draft) => void; entities: Entity[] }) {
  const { draft, setDraft } = props;
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const items = props.entities
    .filter((e) => e.kind === "item" && !e.deletedAt)
    .filter((e) => !q || e.name.toLowerCase().includes(q))
    .sort((a, b) => a.name.localeCompare(b.name))
    .slice(0, 40);

  return (
    <Card className="space-y-2">
      {draft.inventory.length > 0 && (
        <ul className="divide-y divide-slate-800">
          {draft.inventory.map((row) => {
            const entity = props.entities.find((e) => e.id === row.itemId);
            return (
              <li key={row.id} className="flex items-center justify-between gap-2 py-1.5 text-sm">
                <span>
                  {entity ? displayName(entity) : row.itemId}
                  {row.qty > 1 ? ` ×${row.qty}` : ""}
                </span>
                <span className="flex items-center gap-2">
                  <Chip
                    active={row.equipped}
                    onClick={() =>
                      setDraft({
                        ...draft,
                        inventory: draft.inventory.map((r) =>
                          r.id === row.id ? { ...r, equipped: !r.equipped } : r,
                        ),
                      })
                    }
                  >
                    {row.equipped ? S.actions.unequip : S.actions.equip}
                  </Chip>
                  <GhostButton
                    danger
                    onClick={() =>
                      setDraft({ ...draft, inventory: draft.inventory.filter((r) => r.id !== row.id) })
                    }
                  >
                    ✕
                  </GhostButton>
                </span>
              </li>
            );
          })}
        </ul>
      )}
      <SearchInput value={query} onChange={setQuery} placeholder={S.actions.search} />
      <ul className="divide-y divide-slate-800">
        {items.map((item) => (
          <li key={item.id} className="flex items-center justify-between gap-2 py-1.5 text-sm">
            <div className="min-w-0">
              <div className="truncate">{displayName(item)}</div>
              {item.kind === "item" && (
                <div className="text-xs text-slate-500">
                  {[
                    item.data.costGp !== undefined ? `${item.data.costGp} gp` : null,
                    item.data.weightLb ? `${item.data.weightLb} lb` : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </div>
              )}
            </div>
            <GhostButton
              onClick={() =>
                setDraft({
                  ...draft,
                  inventory: [
                    ...draft.inventory,
                    { id: crypto.randomUUID(), itemId: item.id, qty: 1, equipped: false },
                  ],
                })
              }
            >
              {S.actions.add}
            </GhostButton>
          </li>
        ))}
      </ul>
    </Card>
  );
}
