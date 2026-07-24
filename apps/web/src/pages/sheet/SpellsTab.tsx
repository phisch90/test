import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  displayName,
  spellsForList,
  type Character,
  type SpellcastingBlock,
} from "@codex35/core";
import { S } from "../../strings.js";
import { useCompendium } from "../../lib/hooks.js";
import { Card, Chip, GhostButton, SearchInput, SectionTitle, fmtMod } from "../../ui/bits.js";
import type { TabProps } from "./index.js";

export function SpellsTab(props: TabProps) {
  return (
    <div className="space-y-3">
      {props.sheet.spellcasting.map((block) => (
        <CasterBlock key={block.classId} block={block} {...props} />
      ))}
    </div>
  );
}

function emptySpellState(): NonNullable<Character["spellState"][string]> {
  return { known: [], prepared: [], usedSlots: [] };
}

function CasterBlock({
  block,
  character,
  save,
}: TabProps & { block: SpellcastingBlock }) {
  const compendium = useCompendium();
  const [query, setQuery] = useState("");
  const [browseLevel, setBrowseLevel] = useState<number | null>(null);
  const [onlySpellbook, setOnlySpellbook] = useState(true);

  const entries = useMemo(
    () => (compendium ? spellsForList(compendium, block.spellListId) : []),
    [compendium, block.spellListId],
  );
  const state = character.spellState[block.classId] ?? emptySpellState();
  const knownSet = new Set(state.known);
  const isPrepared = block.model === "prepared";
  // „Zauberbuch"-Filter nur anbieten, wenn der vorbereitende Caster überhaupt
  // eine Merkliste pflegt (Wizard); Cleric/Druide kennen die ganze Liste.
  const spellbookActive = isPrepared && state.known.length > 0 && onlySpellbook;

  const nameOf = (spellId: string): string => {
    const spell = compendium?.get(spellId);
    return spell ? displayName(spell) : spellId;
  };

  const slotFor = (level: number) => block.slots.find((s) => s.level === level);

  const mutate = (fn: (s: NonNullable<Character["spellState"][string]>) => void) =>
    save((c) => {
      const s = (c.spellState[block.classId] ??= emptySpellState());
      fn(s);
      // Direkte Index-Zuweisung kann Sparse-Löcher erzeugen — normalisieren,
      // damit Export (JSON) und Zod-Import sauber bleiben.
      s.usedSlots = Array.from(s.usedSlots, (v) => v ?? 0);
    });

  const castAt = (level: number) => {
    const slot = slotFor(level);
    if (!slot || slot.total === null) return;
    const total = slot.total;
    mutate((s) => {
      s.usedSlots[level] = Math.min(total, (s.usedSlots[level] ?? 0) + 1);
    });
  };

  const canCastAt = (level: number) => {
    const slot = slotFor(level);
    return slot !== undefined && slot.total !== null && (state.usedSlots[level] ?? 0) < slot.total;
  };

  // Vorbereitete Zauber nach Grad gruppieren (Instanzen zählen).
  const preparedByLevel = new Map<number, { spellId: string; count: number; firstIndex: number }[]>();
  state.prepared.forEach((p, index) => {
    const group = preparedByLevel.get(p.slotLevel) ?? [];
    const existing = group.find((g) => g.spellId === p.spellId);
    if (existing) existing.count += 1;
    else group.push({ spellId: p.spellId, count: 1, firstIndex: index });
    preparedByLevel.set(p.slotLevel, group);
  });

  const knownByLevel = new Map<number, string[]>();
  for (const spellId of state.known) {
    const entry = entries.find((e) => e.spellId === spellId);
    const level = entry?.level ?? 0;
    knownByLevel.set(level, [...(knownByLevel.get(level) ?? []), spellId]);
  }

  const availableLevels = block.slots.filter((s) => s.total !== null).map((s) => s.level);
  const maxAvailableLevel = Math.max(-1, ...availableLevels);

  const browsable = entries.filter((e) => {
    if (e.spell === null) return false;
    if (browseLevel !== null && e.level !== browseLevel) return false;
    if (spellbookActive && !knownSet.has(e.spellId)) return false;
    const q = query.trim().toLowerCase();
    return !q || e.spell.name.toLowerCase().includes(q);
  });

  return (
    <Card>
      <SectionTitle>
        {block.className} — {isPrepared ? "vorbereitet" : "spontan"}
      </SectionTitle>
      <p className="mb-2 text-xs text-slate-400">
        {S.sheet.casterLevel} {block.casterLevel.total} · {S.spells.dc} {block.dcBase} + {S.spells.level} ·{" "}
        {S.abilities[block.ability]} {fmtMod(block.abilityMod)}
      </p>

      {/* Slots mit Pips */}
      <ul className="space-y-1.5">
        {block.slots.map((slot) => {
          if (slot.total === null) return null;
          const used = state.usedSlots[slot.level] ?? 0;
          return (
            <li key={slot.level} className="flex items-center gap-2 text-sm">
              <span className="w-16 shrink-0 text-slate-400">
                {S.spells.level} {slot.level}
              </span>
              <span className="flex-1 font-mono text-xs">
                {Array.from({ length: slot.total }, (_, i) => (i < used ? "●" : "○")).join(" ")}
                {slot.bonus > 0 && <span className="ml-1 text-emerald-500">(+{slot.bonus})</span>}
              </span>
              <span className="w-16 text-right text-xs text-slate-500">
                {S.spells.dc} {block.dcBase + slot.level}
              </span>
              <GhostButton
                onClick={() =>
                  mutate((s) => {
                    s.usedSlots[slot.level] = Math.max(0, (s.usedSlots[slot.level] ?? 0) - 1);
                  })
                }
              >
                −
              </GhostButton>
              <GhostButton disabled={!canCastAt(slot.level)} onClick={() => castAt(slot.level)}>
                +
              </GhostButton>
            </li>
          );
        })}
      </ul>
      <div className="mt-2">
        <GhostButton onClick={() => mutate((s) => void (s.usedSlots = []))}>
          🌙 {S.spells.rest}
        </GhostButton>
      </div>

      {/* Vorbereitete bzw. bekannte Zauber */}
      <div className="mt-4">
        <SectionTitle>
          {isPrepared ? S.spells.prepared : S.spells.known}
          {!isPrepared && block.spellsKnown && (
            <span className="ml-2 normal-case text-slate-500">
              ({S.spells.knownLimit(
                state.known.length,
                block.spellsKnown.filter((k) => k !== null).reduce((a, b) => a + (b ?? 0), 0).toString(),
              )})
            </span>
          )}
        </SectionTitle>

        {isPrepared ? (
          <ul className="divide-y divide-slate-800">
            {[...preparedByLevel.keys()]
              .sort((a, b) => a - b)
              .flatMap((level) =>
                (preparedByLevel.get(level) ?? []).map((group) => (
                  <li key={`${level}:${group.spellId}`} className="flex items-center gap-2 py-1.5 text-sm">
                    <Link
                      to="/kompendium/$kind/$entityId"
                      params={{ kind: "spell", entityId: group.spellId }}
                      className="min-w-0 flex-1 truncate hover:text-amber-300"
                    >
                      {nameOf(group.spellId)}
                      {group.count > 1 && <span className="text-slate-400"> ×{group.count}</span>}
                      <span className="ml-1 text-xs text-slate-500">
                        {S.spells.level} {level}
                      </span>
                    </Link>
                    <GhostButton disabled={!canCastAt(level)} onClick={() => castAt(level)}>
                      ✨ {S.spells.cast}
                    </GhostButton>
                    <GhostButton
                      danger
                      onClick={() =>
                        mutate((s) => {
                          const index = s.prepared.findIndex(
                            (p) => p.spellId === group.spellId && p.slotLevel === level,
                          );
                          if (index >= 0) s.prepared.splice(index, 1);
                        })
                      }
                    >
                      ✕
                    </GhostButton>
                  </li>
                )),
              )}
            {state.prepared.length === 0 && (
              <li className="py-2 text-sm text-slate-500">Noch nichts vorbereitet.</li>
            )}
          </ul>
        ) : (
          <ul className="divide-y divide-slate-800">
            {[...knownByLevel.keys()]
              .sort((a, b) => a - b)
              .flatMap((level) =>
                (knownByLevel.get(level) ?? []).map((spellId) => (
                  <li key={spellId} className="flex items-center gap-2 py-1.5 text-sm">
                    <Link
                      to="/kompendium/$kind/$entityId"
                      params={{ kind: "spell", entityId: spellId }}
                      className="min-w-0 flex-1 truncate hover:text-amber-300"
                    >
                      {nameOf(spellId)}
                      <span className="ml-1 text-xs text-slate-500">
                        {S.spells.level} {level}
                      </span>
                    </Link>
                    <GhostButton disabled={!canCastAt(level)} onClick={() => castAt(level)}>
                      ✨ {S.spells.cast}
                    </GhostButton>
                    <GhostButton
                      danger
                      onClick={() =>
                        mutate((s) => void (s.known = s.known.filter((id) => id !== spellId)))
                      }
                    >
                      ✕
                    </GhostButton>
                  </li>
                )),
              )}
            {state.known.length === 0 && (
              <li className="py-2 text-sm text-slate-500">Noch keine Zauber gelernt.</li>
            )}
          </ul>
        )}
        {isPrepared && state.prepared.length > 0 && (
          <p className="mt-1 text-[10px] text-slate-500">{S.spells.preparedHint}</p>
        )}
      </div>

      {/* Browser über die Klassenliste */}
      <div className="mt-4 space-y-2">
        <SectionTitle>{S.spells.browse}</SectionTitle>
        <div className="flex flex-wrap items-center gap-1.5">
          {availableLevels.map((level) => (
            <Chip
              key={level}
              active={browseLevel === level}
              onClick={() => setBrowseLevel(browseLevel === level ? null : level)}
            >
              {S.spells.level} {level}
            </Chip>
          ))}
          {isPrepared && state.known.length > 0 && (
            <Chip active={onlySpellbook} onClick={() => setOnlySpellbook(!onlySpellbook)}>
              📖 {S.spells.onlySpellbook}
            </Chip>
          )}
        </div>
        <SearchInput value={query} onChange={setQuery} placeholder={S.actions.search} />
        <ul className="max-h-72 divide-y divide-slate-800 overflow-y-auto">
          {browsable.slice(0, 80).map((entry) => (
            <li key={entry.spellId} className="flex items-center gap-2 py-1.5 text-sm">
              <Link
                to="/kompendium/$kind/$entityId"
                params={{ kind: "spell", entityId: entry.spellId }}
                className="min-w-0 flex-1 hover:text-amber-300"
              >
                <span className="truncate">{entry.spell ? displayName(entry.spell) : entry.spellId}</span>
                <span className="ml-1 text-xs text-slate-500">
                  {S.spells.level} {entry.level}
                </span>
                {entry.spell?.data.summary && (
                  <div className="truncate text-xs text-slate-500">{entry.spell.data.summary}</div>
                )}
              </Link>
              {isPrepared && (
                <>
                  <GhostButton
                    onClick={() =>
                      mutate((s) => {
                        if (s.known.includes(entry.spellId)) {
                          s.known = s.known.filter((id) => id !== entry.spellId);
                        } else {
                          s.known.push(entry.spellId);
                        }
                      })
                    }
                  >
                    {knownSet.has(entry.spellId) ? "📖✓" : "📖"}
                  </GhostButton>
                  <GhostButton
                    disabled={entry.level > maxAvailableLevel}
                    onClick={() =>
                      mutate((s) => void s.prepared.push({ spellId: entry.spellId, slotLevel: entry.level }))
                    }
                  >
                    + {S.spells.prepare}
                  </GhostButton>
                </>
              )}
              {!isPrepared &&
                (knownSet.has(entry.spellId) ? (
                  <span className="text-xs text-emerald-500">✓</span>
                ) : (
                  <GhostButton
                    disabled={entry.level > maxAvailableLevel}
                    onClick={() => mutate((s) => void s.known.push(entry.spellId))}
                  >
                    + {S.spells.learn}
                  </GhostButton>
                ))}
            </li>
          ))}
          {browsable.length === 0 && (
            <li className="py-2 text-sm text-slate-500">{S.compendium.empty}</li>
          )}
        </ul>
      </div>
    </Card>
  );
}
