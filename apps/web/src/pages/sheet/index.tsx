import { useState } from "react";
import { Link, useNavigate, useParams } from "@tanstack/react-router";
import type { Character, DerivedSheet, StatValue } from "@codex35/core";
import { S } from "../../strings.js";
import { CharacterRepo } from "../../db/repo.js";
import { useCharacter, useSheet } from "../../lib/hooks.js";
import { useDiceStore } from "../../lib/diceStore.js";
import { BreakdownSheet } from "../../ui/Breakdown.js";
import { Chip, GhostButton, fmtMod } from "../../ui/bits.js";
import { CombatTab, SkillsTab, StatsTab } from "./tabs-core.js";
import { FeatsTab, InventoryTab, NotesTab } from "./tabs-more.js";
import { SpellsTab } from "./SpellsTab.js";

export interface TabProps {
  character: Character;
  sheet: DerivedSheet;
  /** Mutiert eine Kopie und persistiert (rev++, liveQuery aktualisiert die UI). */
  save: (mutate: (c: Character) => void) => void;
  openBreakdown: (title: string, value: StatValue, rollable?: boolean) => void;
}

type TabKey = keyof typeof S.sheet.tabs;

export function CharacterSheetPage() {
  const { charId } = useParams({ strict: false }) as { charId: string };
  const navigate = useNavigate();
  const character = useCharacter(charId);
  const sheet = useSheet(character);
  const [tab, setTab] = useState<TabKey>("stats");
  const [breakdown, setBreakdown] = useState<{
    title: string;
    value: StatValue;
    rollable: boolean;
  } | null>(null);
  const roll = useDiceStore((s) => s.roll);

  if (character === undefined) return <p className="text-slate-400">{S.misc.loading}</p>;
  if (character === null) return <p className="text-slate-400">Charakter nicht gefunden.</p>;
  if (!sheet) return <p className="text-slate-400">{S.misc.loading}</p>;

  // Mutiert immer den frischen DB-Stand (nicht den Render-Stand) — schnelle
  // Doppel-Taps gehen sonst verloren.
  const save: TabProps["save"] = (mutate) => {
    void CharacterRepo.mutate(character.id, mutate);
  };

  const openBreakdown: TabProps["openBreakdown"] = (title, value, rollable = true) =>
    setBreakdown({ title, value, rollable });

  const tabProps: TabProps = { character, sheet, save, openBreakdown };
  const hasSpells = sheet.spellcasting.length > 0;
  const tabs = (Object.keys(S.sheet.tabs) as TabKey[]).filter((t) => t !== "spells" || hasSpells);

  const remove = async () => {
    if (confirm(S.misc.confirmDelete(character.name))) {
      await CharacterRepo.remove(character);
      void navigate({ to: "/" });
    }
  };

  return (
    <div className="space-y-3">
      <header className="flex items-start gap-3">
        {character.portrait && (
          <img src={character.portrait} alt="" className="h-16 w-16 rounded-xl object-cover" />
        )}
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-xl font-bold">{character.name}</h1>
          <p className="text-sm text-slate-400">
            {sheet.classLevels.map((c) => `${c.className} ${c.level}`).join(" / ")} · {S.sheet.level}{" "}
            {sheet.totalLevel}
            {sheet.ecl !== sheet.totalLevel && ` (ECL ${sheet.ecl})`}
            {sheet.xp.nextLevelAt !== null && character.xp >= sheet.xp.nextLevelAt && (
              <Link
                to="/charaktere/$charId/stufenaufstieg"
                params={{ charId: character.id }}
                className="ml-2 rounded-full bg-emerald-700/40 px-2 py-0.5 text-xs font-semibold text-emerald-300"
              >
                {S.levelUp.ready}
              </Link>
            )}
          </p>
          {/* HP-Leiste: Anpassung in maximal zwei Taps. */}
          <div className="mt-1 flex items-center gap-2">
            <span className="text-sm font-semibold">
              {S.sheet.hp} {sheet.hp.current}/{sheet.hp.max}
              {sheet.hp.temp > 0 && <span className="text-sky-400"> +{sheet.hp.temp}</span>}
            </span>
            <GhostButton onClick={() => save((c) => void (c.hp.damage += 1))}>−1</GhostButton>
            <GhostButton onClick={() => save((c) => void (c.hp.damage += 5))}>−5</GhostButton>
            <GhostButton onClick={() => save((c) => void (c.hp.damage = Math.max(0, c.hp.damage - 1)))}>
              +1
            </GhostButton>
            <GhostButton onClick={() => save((c) => void (c.hp.damage = 0))}>voll</GhostButton>
          </div>
        </div>
        <GhostButton danger onClick={() => void remove()}>
          🗑
        </GhostButton>
      </header>

      <div className="flex flex-wrap gap-1">
        {tabs.map((key) => (
          <Chip key={key} active={tab === key} onClick={() => setTab(key)}>
            {S.sheet.tabs[key]}
          </Chip>
        ))}
      </div>

      {tab === "stats" && <StatsTab {...tabProps} />}
      {tab === "combat" && <CombatTab {...tabProps} />}
      {tab === "skills" && <SkillsTab {...tabProps} />}
      {tab === "spells" && hasSpells && <SpellsTab {...tabProps} />}
      {tab === "inventory" && <InventoryTab {...tabProps} />}
      {tab === "feats" && <FeatsTab {...tabProps} />}
      {tab === "notes" && <NotesTab {...tabProps} />}

      <BreakdownSheet
        open={breakdown !== null}
        onClose={() => setBreakdown(null)}
        title={breakdown?.title ?? ""}
        value={breakdown?.value ?? null}
        onRoll={
          breakdown?.rollable
            ? () => {
                const mod = breakdown.value.total;
                roll(`1d20${mod >= 0 ? "+" : ""}${mod}`, `${character.name}: ${breakdown.title}`);
                setBreakdown(null);
              }
            : undefined
        }
      />
    </div>
  );
}

export function statText(value: StatValue): string {
  return fmtMod(value.total);
}
