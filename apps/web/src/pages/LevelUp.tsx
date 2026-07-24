import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "@tanstack/react-router";
import {
  ABILITIES,
  deriveSheet,
  displayName,
  maxRanks,
  parseDice,
  rollDice,
  spellsForList,
  type Ability,
  type Character,
} from "@codex35/core";
import { S } from "../strings.js";
import { CharacterRepo } from "../db/repo.js";
import { cryptoRng } from "../lib/rng.js";
import {
  useAllEntities,
  useCharacter,
  useCompendium,
  useHouseRules,
  useSheet,
} from "../lib/hooks.js";
import { Card, Chip, GhostButton, PrimaryButton, SearchInput, SectionTitle, fmtMod } from "../ui/bits.js";

export function LevelUpPage() {
  const { charId } = useParams({ strict: false }) as { charId: string };
  const navigate = useNavigate();
  const character = useCharacter(charId);
  const compendium = useCompendium();
  const entities = useAllEntities();
  const houseRules = useHouseRules();
  const sheetBefore = useSheet(character);

  const [classId, setClassId] = useState<string | null>(null);
  const [showAllClasses, setShowAllClasses] = useState(false);
  const [hpRoll, setHpRoll] = useState<number | null>(null);
  const [abilityPick, setAbilityPick] = useState<Ability | null>(null);
  const [ranks, setRanks] = useState<Record<string, number> | null>(null);
  const [newFeatIds, setNewFeatIds] = useState<string[]>([]);
  const [newKnown, setNewKnown] = useState<string[]>([]);
  const [featQuery, setFeatQuery] = useState("");
  const [spellQuery, setSpellQuery] = useState("");

  // Defaults, sobald der Charakter geladen ist.
  useEffect(() => {
    if (!character) return;
    setClassId((prev) => prev ?? character.levels[character.levels.length - 1]?.classId ?? null);
    setRanks((prev) => prev ?? { ...character.skillRanks });
  }, [character]);

  const newTotal = (character?.levels.length ?? 0) + 1;
  const needsAbility = newTotal % 4 === 0;

  const afterCharacter: Character | null = useMemo(() => {
    if (!character || !classId || ranks === null) return null;
    const copy = structuredClone(character);
    // TP-Wurf hart auf 1..TW klemmen und runden — getippte Dezimal-/Ausreißer-
    // Werte würden sonst das Schema (int) und damit den Export brechen.
    const cls = compendium?.get(classId);
    const die = cls?.kind === "class" ? cls.data.hitDie : 12;
    const clampedHp =
      hpRoll === null ? ("avg" as const) : Math.min(Math.max(1, Math.round(hpRoll)), die);
    copy.levels.push({ classId, hpRoll: clampedHp });
    if (needsAbility) {
      const index = Math.floor(newTotal / 4) - 1;
      const ups = [...copy.abilities.levelUps];
      while (ups.length <= index) ups.push(null);
      ups[index] = abilityPick;
      copy.abilities.levelUps = ups;
    }
    copy.skillRanks = { ...ranks };
    copy.feats = [...copy.feats, ...newFeatIds.map((featId) => ({ featId }))];
    if (newKnown.length > 0) {
      const state = (copy.spellState[classId] ??= { known: [], prepared: [], usedSlots: [] });
      state.known = [...state.known, ...newKnown.filter((id) => !state.known.includes(id))];
    }
    return copy;
  }, [character, classId, ranks, hpRoll, needsAbility, newTotal, abilityPick, newFeatIds, newKnown, compendium]);

  const sheetAfter = useMemo(
    () => (afterCharacter && compendium ? deriveSheet(afterCharacter, compendium, houseRules) : undefined),
    [afterCharacter, compendium, houseRules],
  );

  if (character === undefined || !compendium || !entities) {
    return <p className="text-slate-400">{S.misc.loading}</p>;
  }
  if (character === null) return <p className="text-slate-400">Charakter nicht gefunden.</p>;

  const chosenClass = classId ? compendium.get(classId) : undefined;
  const hitDie = chosenClass?.kind === "class" ? chosenClass.data.hitDie : null;

  // Klassenwechsel setzt die Zauberauswahl zurück — sonst landen die Picks
  // der alten Klasse unsichtbar im spellState der neuen.
  const chooseClass = (id: string) => {
    if (id !== classId) setNewKnown([]);
    setClassId(id);
  };

  const existingClassIds = [...new Set(character.levels.map((l) => l.classId))];
  const baseClasses = entities
    .filter((e) => e.kind === "class" && !e.deletedAt)
    .filter((e) => e.source === "homebrew" || e.tags.includes("base") || showAllClasses)
    .sort((a, b) => a.name.localeCompare(b.name));

  const skillLeft = sheetAfter ? sheetAfter.skillPoints.available - sheetAfter.skillPoints.spent : 0;
  const featSlotsLeft = sheetAfter ? sheetAfter.featSlots.available - sheetAfter.featSlots.used : 0;

  // Neue Zauber nur für spontane Caster der gewählten Klasse (Wizard pflegt
  // sein Zauberbuch jederzeit im Zauber-Tab).
  const castingAfter = sheetAfter?.spellcasting.find((b) => b.classId === classId);
  const isSpontaneous = castingAfter?.model === "spontaneous";
  const knownLimit = castingAfter?.spellsKnown
    ? castingAfter.spellsKnown.reduce<number>((sum, k) => sum + (k ?? 0), 0)
    : null;
  const knownCount = classId
    ? (character.spellState[classId]?.known.length ?? 0) + newKnown.length
    : 0;
  const spellEntries =
    isSpontaneous && castingAfter ? spellsForList(compendium, castingAfter.spellListId) : [];
  const maxSpellLevel = castingAfter
    ? Math.max(-1, ...castingAfter.slots.filter((s) => s.total !== null).map((s) => s.level))
    : -1;

  // Je-Grad-Limit aus der spellsKnown-Zeile durchsetzen (Hexenmeister 4 darf
  // genau 1 Grad-2-Zauber kennen, nicht drei).
  const knownAtLevel = (level: number) => {
    const existing = classId ? (character?.spellState[classId]?.known ?? []) : [];
    const knownIds = new Set([...existing, ...newKnown]);
    return spellEntries.filter((e) => e.level === level && knownIds.has(e.spellId)).length;
  };
  const canLearnLevel = (level: number) => {
    const limit = castingAfter?.spellsKnown?.[level];
    if (limit === undefined || limit === null) return true;
    return knownAtLevel(level) < limit;
  };

  const rollHp = () => {
    if (!hitDie) return;
    const expr = parseDice(`1d${hitDie}`);
    if (expr) setHpRoll(rollDice(expr, cryptoRng).total);
  };

  const apply = async () => {
    if (!afterCharacter) return;
    await CharacterRepo.save(afterCharacter);
    void navigate({ to: "/charaktere/$charId", params: { charId } });
  };

  const allClassSkillIds = new Set<string>();
  for (const id of existingClassIds.concat(classId ? [classId] : [])) {
    const cls = compendium.get(id);
    if (cls?.kind === "class") for (const s of cls.data.classSkillIds) allClassSkillIds.add(s);
  }
  const skills = entities
    .filter((e) => e.kind === "skill" && !e.deletedAt)
    .sort((a, b) => a.name.localeCompare(b.name));

  // Bereits vorhandene Talente ausblenden — außer sie sind stackable (Toughness).
  const ownedFeatIds = new Set(character.feats.map((f) => f.featId));
  const feats = entities
    .filter((e) => e.kind === "feat" && !e.deletedAt)
    .filter((e) => e.kind === "feat" && (e.data.stackable || !ownedFeatIds.has(e.id)))
    .filter((e) => !featQuery.trim() || e.name.toLowerCase().includes(featQuery.trim().toLowerCase()))
    .sort((a, b) => a.name.localeCompare(b.name))
    .slice(0, 40);

  return (
    <div className="space-y-3">
      <h1 className="text-xl font-bold">
        {S.levelUp.title} — {character.name}
      </h1>
      <p className="text-sm text-slate-400">
        {S.levelUp.newLevel}: {newTotal}
        {sheetBefore &&
          character.xp < (sheetBefore.xp.nextLevelAt ?? Infinity) &&
          sheetBefore.xp.nextLevelAt !== null && (
            <span className="ml-2 text-amber-400">
              (EP: {character.xp.toLocaleString("de-DE")} /{" "}
              {sheetBefore.xp.nextLevelAt.toLocaleString("de-DE")} — noch nicht erreicht, der DM
              entscheidet)
            </span>
          )}
      </p>

      <Card>
        <SectionTitle>{S.levelUp.chooseClass}</SectionTitle>
        <div className="flex flex-wrap gap-1.5">
          {existingClassIds.map((id) => {
            const cls = compendium.get(id);
            return (
              <Chip key={id} active={classId === id} onClick={() => chooseClass(id)}>
                {cls ? displayName(cls) : id}
              </Chip>
            );
          })}
        </div>
        <details className="mt-2">
          <summary className="cursor-pointer text-sm text-slate-400">andere Klasse wählen…</summary>
          <div className="mt-1 flex items-center gap-2">
            <Chip active={showAllClasses} onClick={() => setShowAllClasses(!showAllClasses)}>
              auch Prestigeklassen
            </Chip>
          </div>
          <ul className="mt-1 max-h-60 divide-y divide-slate-800 overflow-y-auto">
            {baseClasses.map((cls) => (
              <li key={cls.id}>
                <button
                  onClick={() => chooseClass(cls.id)}
                  className={`w-full px-2 py-1.5 text-left text-sm hover:bg-slate-800 ${
                    classId === cls.id ? "text-amber-300" : ""
                  }`}
                >
                  {displayName(cls)}
                  {cls.kind === "class" && (
                    <span className="ml-1 text-xs text-slate-500">W{cls.data.hitDie}</span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        </details>
      </Card>

      <Card>
        <SectionTitle>
          {S.levelUp.hpRoll} {hitDie ? `(W${hitDie})` : ""}
        </SectionTitle>
        <div className="flex items-center gap-2">
          <input
            type="number"
            min={1}
            max={hitDie ?? 12}
            value={hpRoll ?? ""}
            onChange={(e) =>
              setHpRoll(Number.isNaN(e.target.valueAsNumber) ? null : Math.round(e.target.valueAsNumber))
            }
            className="w-24 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-lg font-semibold"
          />
          <GhostButton onClick={rollHp} disabled={!hitDie}>
            🎲 {S.levelUp.rollHp}
          </GhostButton>
          <span className="text-xs text-slate-500">leer = Durchschnitt</span>
        </div>
      </Card>

      {needsAbility && (
        <Card>
          <SectionTitle>{S.levelUp.abilityIncrease}</SectionTitle>
          <div className="flex flex-wrap gap-1.5">
            {ABILITIES.map((ability) => (
              <Chip
                key={ability}
                active={abilityPick === ability}
                onClick={() => setAbilityPick(abilityPick === ability ? null : ability)}
              >
                {S.abilityNames[ability]} +1
              </Chip>
            ))}
          </div>
        </Card>
      )}

      <Card>
        <SectionTitle>{S.levelUp.skills}</SectionTitle>
        <div className={`mb-2 text-sm font-semibold ${skillLeft < 0 ? "text-red-400" : "text-emerald-400"}`}>
          {S.wizard.pointsLeft}: {skillLeft}
        </div>
        <ul className="max-h-80 divide-y divide-slate-800 overflow-y-auto">
          {skills.map((skill) => {
            const isClass = allClassSkillIds.has(skill.id);
            const current = ranks?.[skill.id] ?? 0;
            const max = maxRanks(newTotal, isClass);
            // Schrittweite MUSS zur Kostenbasis der Engine passen (Union aller
            // Klassen, siehe derive.ts skillPointsSpent) — sonst kosten Ränge
            // alter Klassenfertigkeiten beim klassenfremden Aufstieg die Hälfte.
            const step = isClass ? 1 : 0.5;
            const setSkill = (value: number) => {
              const next = { ...(ranks ?? {}) };
              if (value <= 0) delete next[skill.id];
              else next[skill.id] = value;
              setRanks(next);
            };
            return (
              <li key={skill.id} className="flex items-center justify-between gap-2 py-1.5 text-sm">
                <span className={isClass ? "" : "text-slate-400"}>
                  {displayName(skill)}
                  {isClass && <span className="ml-1 text-[10px] text-amber-400">●</span>}
                  <span className="ml-1 text-xs text-slate-500">
                    {current}/{max}
                  </span>
                </span>
                <span className="flex items-center gap-2">
                  <GhostButton
                    disabled={current <= (character.skillRanks[skill.id] ?? 0)}
                    onClick={() => setSkill(current - step)}
                  >
                    −
                  </GhostButton>
                  <GhostButton disabled={current >= max || skillLeft <= 0} onClick={() => setSkill(current + step)}>
                    +
                  </GhostButton>
                </span>
              </li>
            );
          })}
        </ul>
      </Card>

      {(featSlotsLeft > 0 || newFeatIds.length > 0) && (
        <Card>
          <SectionTitle>
            {S.levelUp.feats} ({S.wizard.slotsLeft}: {featSlotsLeft})
          </SectionTitle>
          {newFeatIds.length > 0 && (
            <div className="mb-1 flex flex-wrap gap-1.5">
              {newFeatIds.map((id) => {
                const feat = compendium.get(id);
                return (
                  <Chip key={id} active onClick={() => setNewFeatIds(newFeatIds.filter((f) => f !== id))}>
                    {feat ? displayName(feat) : id} ✕
                  </Chip>
                );
              })}
            </div>
          )}
          <SearchInput value={featQuery} onChange={setFeatQuery} placeholder={S.actions.search} />
          <ul className="mt-1 max-h-60 divide-y divide-slate-800 overflow-y-auto">
            {feats.map((feat) => (
              <li key={feat.id} className="flex items-center justify-between gap-2 py-1.5 text-sm">
                <div className="min-w-0">
                  <div className="truncate">{displayName(feat)}</div>
                  {feat.kind === "feat" && feat.data.benefit && (
                    <div className="truncate text-xs text-slate-500">{feat.data.benefit}</div>
                  )}
                </div>
                {!newFeatIds.includes(feat.id) && (
                  <GhostButton onClick={() => setNewFeatIds([...newFeatIds, feat.id])}>
                    {S.actions.add}
                  </GhostButton>
                )}
              </li>
            ))}
          </ul>
        </Card>
      )}

      {isSpontaneous && (
        <Card>
          <SectionTitle>
            {S.levelUp.newSpells}
            {knownLimit !== null && (
              <span className="ml-2 normal-case text-slate-500">
                ({S.spells.knownLimit(knownCount, String(knownLimit))})
              </span>
            )}
          </SectionTitle>
          {newKnown.length > 0 && (
            <div className="mb-1 flex flex-wrap gap-1.5">
              {newKnown.map((id) => {
                const spell = compendium.get(id);
                return (
                  <Chip key={id} active onClick={() => setNewKnown(newKnown.filter((s) => s !== id))}>
                    {spell ? displayName(spell) : id} ✕
                  </Chip>
                );
              })}
            </div>
          )}
          <SearchInput value={spellQuery} onChange={setSpellQuery} placeholder={S.actions.search} />
          <ul className="mt-1 max-h-60 divide-y divide-slate-800 overflow-y-auto">
            {spellEntries
              .filter((e) => e.spell !== null && e.level <= maxSpellLevel)
              .filter((e) => !character.spellState[classId ?? ""]?.known.includes(e.spellId))
              .filter(
                (e) =>
                  !spellQuery.trim() ||
                  e.spell!.name.toLowerCase().includes(spellQuery.trim().toLowerCase()),
              )
              .slice(0, 40)
              .map((entry) => (
                <li key={entry.spellId} className="flex items-center justify-between gap-2 py-1.5 text-sm">
                  <span className="min-w-0 truncate">
                    {displayName(entry.spell!)}
                    <span className="ml-1 text-xs text-slate-500">
                      {S.spells.level} {entry.level}
                    </span>
                  </span>
                  {!newKnown.includes(entry.spellId) && (
                    <GhostButton
                      disabled={!canLearnLevel(entry.level)}
                      onClick={() => setNewKnown([...newKnown, entry.spellId])}
                    >
                      {S.actions.add}
                    </GhostButton>
                  )}
                </li>
              ))}
          </ul>
        </Card>
      )}

      {sheetBefore && sheetAfter && (
        <Card>
          <SectionTitle>{S.levelUp.summary}</SectionTitle>
          <ul className="space-y-1 text-sm">
            <li>
              {S.levelUp.hpDelta}: {sheetBefore.hp.max} → <b>{sheetAfter.hp.max}</b>
            </li>
            <li>
              {S.sheet.bab}: {fmtMod(sheetBefore.bab)} → <b>{fmtMod(sheetAfter.bab)}</b>
            </li>
            <li>
              Saves: {fmtMod(sheetBefore.saves.fort.total)}/{fmtMod(sheetBefore.saves.ref.total)}/
              {fmtMod(sheetBefore.saves.will.total)} →{" "}
              <b>
                {fmtMod(sheetAfter.saves.fort.total)}/{fmtMod(sheetAfter.saves.ref.total)}/
                {fmtMod(sheetAfter.saves.will.total)}
              </b>
            </li>
            {sheetAfter.spellcasting.map((block) => (
              <li key={block.classId}>
                {block.className}-{S.sheet.slots}:{" "}
                {block.slots
                  .filter((s) => s.total !== null)
                  .map((s) => s.total)
                  .join("/")}
              </li>
            ))}
          </ul>
          {sheetAfter.issues.length > 0 && (
            <ul className="mt-2 list-inside list-disc text-xs text-amber-400">
              {sheetAfter.issues.map((issue, i) => (
                <li key={i}>{issue.message}</li>
              ))}
            </ul>
          )}
        </Card>
      )}

      <div className="flex justify-between">
        <Link to="/charaktere/$charId" params={{ charId }}>
          <GhostButton>{S.actions.cancel}</GhostButton>
        </Link>
        <PrimaryButton disabled={!afterCharacter || !classId} onClick={() => void apply()}>
          ⬆ {S.levelUp.apply}
        </PrimaryButton>
      </div>
    </div>
  );
}
