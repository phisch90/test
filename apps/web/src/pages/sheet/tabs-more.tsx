import { useState } from "react";
import {
  BONUS_TYPES,
  displayName,
  isStatPath,
  type BonusType,
  type StatPath,
} from "@codex35/core";
import { S } from "../../strings.js";
import { useAllEntities } from "../../lib/hooks.js";
import { Card, Chip, GhostButton, SearchInput, SectionTitle, fmtMod } from "../../ui/bits.js";
import type { TabProps } from "./index.js";

export function SpellsTab({ character, sheet, save }: TabProps) {
  return (
    <div className="space-y-3">
      {sheet.spellcasting.map((block) => (
        <Card key={block.classId}>
          <SectionTitle>
            {block.className} — {block.model === "prepared" ? "vorbereitet" : "spontan"}
          </SectionTitle>
          <p className="mb-2 text-xs text-slate-400">
            {S.sheet.casterLevel} {block.casterLevel.total} · {S.sheet.dcBase} {block.dcBase} + Grad ·{" "}
            {S.abilities[block.ability]} {fmtMod(block.abilityMod)}
          </p>
          <ul className="space-y-1.5">
            {block.slots.map((slot) => {
              if (slot.total === null) return null;
              const used = character.spellState[block.classId]?.usedSlots[slot.level] ?? 0;
              return (
                <li key={slot.level} className="flex items-center gap-2 text-sm">
                  <span className="w-14 shrink-0 text-slate-400">Grad {slot.level}</span>
                  <span className="flex-1 font-mono text-xs">
                    {Array.from({ length: slot.total }, (_, i) => (i < used ? "●" : "○")).join(" ")}
                    {slot.bonus > 0 && (
                      <span className="ml-1 text-emerald-500">(+{slot.bonus} Bonus)</span>
                    )}
                  </span>
                  <span className="text-xs text-slate-500">
                    {used}/{slot.total}
                  </span>
                  <GhostButton
                    onClick={() =>
                      save((c) => {
                        const state = (c.spellState[block.classId] ??= {
                          known: [],
                          prepared: [],
                          usedSlots: [],
                        });
                        state.usedSlots[slot.level] = Math.max(0, (state.usedSlots[slot.level] ?? 0) - 1);
                      })
                    }
                  >
                    −
                  </GhostButton>
                  <GhostButton
                    onClick={() =>
                      save((c) => {
                        const state = (c.spellState[block.classId] ??= {
                          known: [],
                          prepared: [],
                          usedSlots: [],
                        });
                        state.usedSlots[slot.level] = Math.min(
                          slot.total ?? 0,
                          (state.usedSlots[slot.level] ?? 0) + 1,
                        );
                      })
                    }
                  >
                    +
                  </GhostButton>
                </li>
              );
            })}
          </ul>
          <p className="mt-2 text-[10px] text-slate-500">
            DC eines Zaubers = {block.dcBase} + Zaubergrad. Vorbereitung/Zauberbuch kommt in Phase 2 —
            bis dahin: Slots als Zähler, Zauberliste im Kompendium.
          </p>
        </Card>
      ))}
    </div>
  );
}

export function InventoryTab({ character, sheet, save }: TabProps) {
  const entities = useAllEntities();
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const results =
    q.length >= 2
      ? (entities ?? [])
          .filter((e) => e.kind === "item" && !e.deletedAt && e.name.toLowerCase().includes(q))
          .slice(0, 20)
      : [];

  return (
    <div className="space-y-3">
      <Card>
        <SectionTitle>{S.sheet.tabs.inventory}</SectionTitle>
        <ul className="divide-y divide-slate-800">
          {character.inventory.map((row) => {
            const entity = row.itemId ? entities?.find((e) => e.id === row.itemId) : undefined;
            const name = row.customName ?? (entity ? displayName(entity) : "—");
            const weight =
              row.weightLbOverride ?? (entity?.kind === "item" ? (entity.data.weightLb ?? 0) : 0);
            return (
              <li key={row.id} className="flex items-center gap-2 py-1.5 text-sm">
                <div className="min-w-0 flex-1">
                  <div className="truncate">{name}</div>
                  <div className="text-xs text-slate-500">
                    {weight ? `${weight * row.qty} lb` : ""}
                    {row.extraEffects.length > 0 && " · verzaubert"}
                  </div>
                </div>
                <GhostButton
                  onClick={() =>
                    save((c) => {
                      const item = c.inventory.find((r) => r.id === row.id);
                      if (item) item.qty = Math.max(1, item.qty - 1);
                    })
                  }
                >
                  −
                </GhostButton>
                <span className="w-6 text-center font-mono">{row.qty}</span>
                <GhostButton
                  onClick={() =>
                    save((c) => {
                      const item = c.inventory.find((r) => r.id === row.id);
                      if (item) item.qty += 1;
                    })
                  }
                >
                  +
                </GhostButton>
                <Chip
                  active={row.equipped}
                  onClick={() =>
                    save((c) => {
                      const item = c.inventory.find((r) => r.id === row.id);
                      if (item) item.equipped = !item.equipped;
                    })
                  }
                >
                  {row.equipped ? "angelegt" : "Rucksack"}
                </Chip>
                <GhostButton
                  danger
                  onClick={() => save((c) => void (c.inventory = c.inventory.filter((r) => r.id !== row.id)))}
                >
                  ✕
                </GhostButton>
              </li>
            );
          })}
          {character.inventory.length === 0 && (
            <li className="py-2 text-sm text-slate-500">Leer.</li>
          )}
        </ul>
        <p className="mt-2 text-xs text-slate-400">
          Gesamt {sheet.encumbrance.loadLb} lb — {S.sheet.encumbrance[sheet.encumbrance.level]}
        </p>
      </Card>

      <Card>
        <SectionTitle>{S.actions.add}</SectionTitle>
        <SearchInput value={query} onChange={setQuery} placeholder={S.actions.search} />
        <ul className="mt-1 divide-y divide-slate-800">
          {results.map((item) => (
            <li key={item.id} className="flex items-center justify-between gap-2 py-1.5 text-sm">
              <span className="truncate">{displayName(item)}</span>
              <GhostButton
                onClick={() => {
                  save((c) =>
                    void c.inventory.push({
                      id: crypto.randomUUID(),
                      itemId: item.id,
                      qty: 1,
                      equipped: false,
                      extraEffects: [],
                    }),
                  );
                  setQuery("");
                }}
              >
                {S.actions.add}
              </GhostButton>
            </li>
          ))}
        </ul>
        <GhostButton
          onClick={() => {
            const name = prompt("Name des Gegenstands?");
            if (!name) return;
            const weight = Number(prompt("Gewicht in lb?", "0") ?? 0) || 0;
            save((c) =>
              void c.inventory.push({
                id: crypto.randomUUID(),
                customName: name,
                weightLbOverride: weight,
                qty: 1,
                equipped: false,
                extraEffects: [],
              }),
            );
          }}
        >
          + Freier Gegenstand
        </GhostButton>
      </Card>

      <Card>
        <SectionTitle>Geld</SectionTitle>
        <div className="grid grid-cols-4 gap-2">
          {(["pp", "gp", "sp", "cp"] as const).map((coin) => (
            <label key={coin} className="flex flex-col gap-1">
              <span className="text-xs uppercase text-slate-400">{coin}</span>
              <input
                type="number"
                value={character.money[coin]}
                onChange={(e) =>
                  save((c) => void (c.money[coin] = Math.max(0, e.target.valueAsNumber || 0)))
                }
                className="rounded-lg border border-slate-700 bg-slate-900 px-2 py-1.5 text-sm"
              />
            </label>
          ))}
        </div>
      </Card>
    </div>
  );
}

export function FeatsTab({ character, sheet, save }: TabProps) {
  const entities = useAllEntities();
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const results =
    q.length >= 2
      ? (entities ?? [])
          .filter((e) => e.kind === "feat" && !e.deletedAt && e.name.toLowerCase().includes(q))
          .slice(0, 20)
      : [];

  return (
    <div className="space-y-3">
      <Card>
        <SectionTitle>
          {S.sheet.tabs.feats} ({sheet.featSlots.used}/{sheet.featSlots.available})
        </SectionTitle>
        <ul className="divide-y divide-slate-800">
          {character.feats.map((feat, index) => {
            const entity = entities?.find((e) => e.id === feat.featId);
            return (
              <li key={index} className="flex items-center justify-between gap-2 py-1.5 text-sm">
                <div className="min-w-0">
                  <span>{entity ? displayName(entity) : feat.featId}</span>
                  {feat.choice && <span className="text-slate-400"> ({feat.choice})</span>}
                </div>
                <div className="flex gap-1">
                  <GhostButton
                    onClick={() => {
                      const choice = prompt("Auswahl (z.B. Langschwert)?", feat.choice ?? "");
                      if (choice !== null) {
                        save((c) => {
                          const f = c.feats[index];
                          if (f) f.choice = choice || undefined;
                        });
                      }
                    }}
                  >
                    ✎
                  </GhostButton>
                  <GhostButton
                    danger
                    onClick={() => save((c) => void c.feats.splice(index, 1))}
                  >
                    ✕
                  </GhostButton>
                </div>
              </li>
            );
          })}
          {character.feats.length === 0 && <li className="py-2 text-sm text-slate-500">Keine.</li>}
        </ul>
        <SearchInput value={query} onChange={setQuery} placeholder={S.actions.search} />
        <ul className="mt-1 divide-y divide-slate-800">
          {results.map((feat) => (
            <li key={feat.id} className="flex items-center justify-between gap-2 py-1.5 text-sm">
              <span className="truncate">{displayName(feat)}</span>
              <GhostButton onClick={() => save((c) => void c.feats.push({ featId: feat.id }))}>
                {S.actions.add}
              </GhostButton>
            </li>
          ))}
        </ul>
      </Card>

      <Card>
        <SectionTitle>{S.sheet.features}</SectionTitle>
        <ul className="divide-y divide-slate-800">
          {sheet.features.map((feature) => (
            <li key={feature.key} className="py-1.5 text-sm">
              <div className="flex items-center justify-between gap-2">
                <span>
                  {feature.name}
                  <span className="ml-1 text-xs text-slate-500">
                    ({feature.className} {feature.level})
                  </span>
                </span>
                {feature.toggleable && (
                  <Chip
                    active={feature.active}
                    onClick={() =>
                      save((c) => {
                        // Alle Toggle-Effekt-Keys dieses Features gemeinsam schalten.
                        const keys = [0, 1, 2, 3, 4]
                          .map((i) => `${feature.key}.${i}`);
                        const active = keys.some((k) => c.toggledEffectKeys.includes(k));
                        c.toggledEffectKeys = active
                          ? c.toggledEffectKeys.filter((k) => !keys.includes(k))
                          : [...c.toggledEffectKeys, ...keys];
                      })
                    }
                  >
                    {feature.active ? "aktiv" : "aus"}
                  </Chip>
                )}
              </div>
              {feature.description && (
                <p className="mt-0.5 text-xs text-slate-500">{feature.description}</p>
              )}
            </li>
          ))}
          {sheet.features.length === 0 && <li className="py-2 text-sm text-slate-500">Keine.</li>}
        </ul>
      </Card>
    </div>
  );
}

const MISC_TARGETS: { path: StatPath; label: string }[] = [
  { path: "ac", label: "RK" },
  { path: "attack.all", label: "Alle Angriffe" },
  { path: "attack.melee", label: "Nahkampf-Angriff" },
  { path: "attack.ranged", label: "Fernkampf-Angriff" },
  { path: "damage.all", label: "Schaden" },
  { path: "save.all", label: "Alle Saves" },
  { path: "save.fort", label: "Fortitude" },
  { path: "save.ref", label: "Reflex" },
  { path: "save.will", label: "Will" },
  { path: "init", label: "Initiative" },
  { path: "hp.max", label: "Max. TP" },
  { path: "speed.land", label: "Bewegung" },
  { path: "skill.all", label: "Alle Fertigkeiten" },
  { path: "ability.str", label: "Stärke" },
  { path: "ability.dex", label: "Geschicklichkeit" },
  { path: "ability.con", label: "Konstitution" },
];

export function NotesTab({ character, save }: TabProps) {
  const entities = useAllEntities();
  const conditions = (entities ?? []).filter((e) => e.kind === "condition" && !e.deletedAt);
  const [notes, setNotes] = useState(character.notes);

  return (
    <div className="space-y-3">
      <Card>
        <SectionTitle>{S.sheet.portrait}</SectionTitle>
        <div className="flex items-center gap-3">
          {character.portrait && (
            <img src={character.portrait} alt="" className="h-20 w-20 rounded-xl object-cover" />
          )}
          <label className="cursor-pointer rounded-lg border border-slate-600 px-3 py-2 text-sm hover:bg-slate-800">
            Bild wählen…
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = () => save((c) => void (c.portrait = String(reader.result)));
                reader.readAsDataURL(file);
                e.target.value = "";
              }}
            />
          </label>
          {character.portrait && (
            <GhostButton danger onClick={() => save((c) => void (c.portrait = undefined))}>
              {S.actions.remove}
            </GhostButton>
          )}
        </div>
      </Card>

      <Card>
        <SectionTitle>{S.sheet.conditions}</SectionTitle>
        <div className="flex flex-wrap gap-1.5">
          {conditions.map((condition) => {
            const active = character.conditionIds.includes(condition.id);
            return (
              <Chip
                key={condition.id}
                active={active}
                onClick={() =>
                  save((c) => {
                    c.conditionIds = active
                      ? c.conditionIds.filter((id) => id !== condition.id)
                      : [...c.conditionIds, condition.id];
                  })
                }
              >
                {displayName(condition)}
              </Chip>
            );
          })}
        </div>
      </Card>

      <Card>
        <SectionTitle>{S.sheet.miscMods}</SectionTitle>
        <ul className="divide-y divide-slate-800">
          {character.miscModifiers.map((mod) => (
            <li key={mod.id} className="flex items-center justify-between gap-2 py-1.5 text-sm">
              <span>
                {MISC_TARGETS.find((t) => t.path === mod.target)?.label ?? mod.target}{" "}
                <span className="font-mono">{fmtMod(mod.value)}</span>
                {mod.note && <span className="text-slate-400"> — {mod.note}</span>}
              </span>
              <GhostButton
                danger
                onClick={() =>
                  save((c) => void (c.miscModifiers = c.miscModifiers.filter((m) => m.id !== mod.id)))
                }
              >
                ✕
              </GhostButton>
            </li>
          ))}
        </ul>
        <MiscModifierForm
          onAdd={(target, bonusType, value, note) =>
            save((c) =>
              void c.miscModifiers.push({ id: crypto.randomUUID(), target, bonusType, value, note }),
            )
          }
        />
      </Card>

      <Card>
        <SectionTitle>{S.sheet.tabs.notes}</SectionTitle>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          onBlur={() => save((c) => void (c.notes = notes))}
          rows={8}
          className="w-full rounded-lg border border-slate-700 bg-slate-900 p-2 text-sm"
          placeholder="Hintergrund, Kontakte, offene Fragen an den DM…"
        />
      </Card>
    </div>
  );
}

function MiscModifierForm(props: {
  onAdd: (target: StatPath, bonusType: BonusType, value: number, note: string) => void;
}) {
  const [target, setTarget] = useState<string>("ac");
  const [bonusType, setBonusType] = useState<BonusType>("untyped");
  const [value, setValue] = useState(1);
  const [note, setNote] = useState("");

  return (
    <div className="mt-2 flex flex-wrap items-end gap-2 text-sm">
      <select
        value={target}
        onChange={(e) => setTarget(e.target.value)}
        className="rounded-lg border border-slate-700 bg-slate-900 px-2 py-1.5"
      >
        {MISC_TARGETS.map((t) => (
          <option key={t.path} value={t.path}>
            {t.label}
          </option>
        ))}
      </select>
      <select
        value={bonusType}
        onChange={(e) => setBonusType(e.target.value as BonusType)}
        className="rounded-lg border border-slate-700 bg-slate-900 px-2 py-1.5"
      >
        {BONUS_TYPES.map((type) => (
          <option key={type} value={type}>
            {type}
          </option>
        ))}
      </select>
      <input
        type="number"
        value={value}
        onChange={(e) => setValue(e.target.valueAsNumber || 0)}
        className="w-16 rounded-lg border border-slate-700 bg-slate-900 px-2 py-1.5"
      />
      <input
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Notiz (z.B. Rage, Bull's Strength)"
        className="flex-1 rounded-lg border border-slate-700 bg-slate-900 px-2 py-1.5"
      />
      <GhostButton
        onClick={() => {
          if (isStatPath(target)) props.onAdd(target, bonusType, value, note);
          setNote("");
        }}
      >
        {S.actions.add}
      </GhostButton>
    </div>
  );
}
