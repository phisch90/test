import { ABILITIES } from "@codex35/core";
import { S } from "../../strings.js";
import { Card, GhostButton, SectionTitle, StatButton, fmtMod } from "../../ui/bits.js";
import { useDiceStore } from "../../lib/diceStore.js";
import type { TabProps } from "./index.js";

export function StatsTab({ character, sheet, save, openBreakdown }: TabProps) {
  return (
    <div className="space-y-3">
      <Card>
        <SectionTitle>Attribute</SectionTitle>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
          {ABILITIES.map((ability) => {
            const block = sheet.abilities[ability];
            return (
              <StatButton
                key={ability}
                big
                label={S.abilities[ability] ?? ability}
                value={`${block.score.total} (${fmtMod(block.mod)})`}
                onClick={() =>
                  openBreakdown(`${S.abilityNames[ability]}`, block.score, false)
                }
              />
            );
          })}
        </div>
      </Card>

      <Card>
        <SectionTitle>Rettungswürfe</SectionTitle>
        <div className="grid grid-cols-3 gap-2">
          {(["fort", "ref", "will"] as const).map((save_) => (
            <StatButton
              key={save_}
              big
              label={S.saves[save_] ?? save_}
              value={fmtMod(sheet.saves[save_].total)}
              onClick={() => openBreakdown(`${S.saves[save_]}-Save`, sheet.saves[save_])}
            />
          ))}
        </div>
      </Card>

      <Card>
        <SectionTitle>{S.sheet.hp}</SectionTitle>
        <div className="grid grid-cols-3 gap-3 text-sm">
          <NumberField
            label={S.sheet.damage}
            value={character.hp.damage}
            onChange={(v) => save((c) => void (c.hp.damage = Math.max(0, v)))}
          />
          <NumberField
            label={S.sheet.nonlethal}
            value={character.hp.nonlethal}
            onChange={(v) => save((c) => void (c.hp.nonlethal = Math.max(0, v)))}
          />
          <NumberField
            label={S.sheet.temp}
            value={character.hp.temp}
            onChange={(v) => save((c) => void (c.hp.temp = Math.max(0, v)))}
          />
        </div>
      </Card>

      <Card>
        <SectionTitle>{S.sheet.xp}</SectionTitle>
        <div className="flex items-center gap-3 text-sm">
          <NumberField
            label={S.sheet.xp}
            value={character.xp}
            onChange={(v) => save((c) => void (c.xp = Math.max(0, v)))}
          />
          <span className="text-slate-400">
            {sheet.xp.nextLevelAt !== null
              ? `${S.sheet.nextLevel}: ${sheet.xp.nextLevelAt.toLocaleString("de-DE")}`
              : "max. Stufe"}
          </span>
        </div>
      </Card>

      {sheet.issues.length > 0 && (
        <Card className="border-amber-800/60">
          <SectionTitle>{S.misc.issues}</SectionTitle>
          <ul className="list-inside list-disc space-y-1 text-xs text-amber-300">
            {sheet.issues.map((issue, i) => (
              <li key={i}>{issue.message}</li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}

export function CombatTab({ sheet, openBreakdown }: TabProps) {
  const roll = useDiceStore((s) => s.roll);
  return (
    <div className="space-y-3">
      <Card>
        <SectionTitle>{S.sheet.ac}</SectionTitle>
        <div className="grid grid-cols-3 gap-2">
          <StatButton
            big
            label={S.sheet.ac}
            value={`${sheet.ac.total.total}`}
            onClick={() => openBreakdown(S.sheet.ac, sheet.ac.total, false)}
          />
          <StatButton label={S.sheet.touch} value={`${sheet.ac.touch}`} />
          <StatButton label={S.sheet.flatFooted} value={`${sheet.ac.flatFooted}`} />
        </div>
      </Card>

      <Card>
        <div className="grid grid-cols-4 gap-2">
          <StatButton
            label={S.sheet.init}
            value={fmtMod(sheet.init.total)}
            onClick={() => openBreakdown(S.sheet.init, sheet.init)}
          />
          <StatButton label={S.sheet.bab} value={fmtMod(sheet.bab)} />
          <StatButton
            label={S.sheet.grapple}
            value={fmtMod(sheet.grapple.total)}
            onClick={() => openBreakdown(S.sheet.grapple, sheet.grapple)}
          />
          <StatButton
            label={S.sheet.speed}
            value={`${sheet.speedFt.total} ft`
            }
            onClick={() => openBreakdown(S.sheet.speed, sheet.speedFt, false)}
          />
        </div>
      </Card>

      <Card>
        <SectionTitle>{S.sheet.attacks}</SectionTitle>
        <ul className="space-y-2">
          {sheet.attacks.map((attack) => (
            <li key={attack.key} className="rounded-lg bg-slate-800/60 p-2">
              <div className="flex items-center justify-between gap-2">
                <button
                  className="min-w-0 flex-1 text-left"
                  onClick={() => openBreakdown(attack.label, attack.attack, false)}
                >
                  <div className="truncate text-sm font-semibold">{attack.label}</div>
                  <div className="text-xs text-slate-400">
                    {attack.bonuses.map(fmtMod).join(" / ")}
                    {attack.damageText !== "—" && (
                      <>
                        {" · "}
                        {S.sheet.damage2} {attack.damageText} · {S.sheet.critical} {attack.critical}
                      </>
                    )}
                  </div>
                  {attack.notes.map((note, i) => (
                    <div key={i} className="text-[10px] text-slate-500">
                      {note}
                    </div>
                  ))}
                </button>
                <GhostButton
                  onClick={() => {
                    const mod = attack.bonuses[0] ?? 0;
                    roll(`1d20${mod >= 0 ? "+" : ""}${mod}`, attack.label);
                  }}
                >
                  🎲
                </GhostButton>
                {attack.damageText !== "—" && (
                  <GhostButton onClick={() => roll(attack.damageText, `${attack.label} — ${S.sheet.damage2}`)}>
                    ⚔️
                  </GhostButton>
                )}
              </div>
            </li>
          ))}
        </ul>
      </Card>

      <Card>
        <SectionTitle>Traglast</SectionTitle>
        <p className="text-sm">
          {sheet.encumbrance.loadLb} lb —{" "}
          <span
            className={
              sheet.encumbrance.level === "light"
                ? "text-emerald-400"
                : sheet.encumbrance.level === "overloaded"
                  ? "text-red-400"
                  : "text-amber-400"
            }
          >
            {S.sheet.encumbrance[sheet.encumbrance.level]}
          </span>
        </p>
        <p className="text-xs text-slate-400">
          leicht ≤ {sheet.encumbrance.lightMaxLb} · mittel ≤ {sheet.encumbrance.mediumMaxLb} · schwer ≤{" "}
          {sheet.encumbrance.heavyMaxLb}
        </p>
      </Card>
    </div>
  );
}

export function SkillsTab({ character, sheet, save, openBreakdown }: TabProps) {
  const roll = useDiceStore((s) => s.roll);
  return (
    <Card>
      <ul className="divide-y divide-slate-800">
        {sheet.skills.map((skill) => {
          const overMax = skill.ranks > skill.maxRanks;
          return (
            <li key={skill.skillId} className="flex items-center gap-2 py-1.5 text-sm">
              <button
                className="min-w-0 flex-1 text-left"
                onClick={() => openBreakdown(skill.name, skill.total)}
              >
                <span className={skill.usable ? "" : "text-slate-500"}>
                  {skill.name}
                  {skill.isClassSkill && <span className="ml-1 text-[10px] text-amber-400">●</span>}
                </span>
                <span className="ml-2 text-xs text-slate-500">
                  {S.sheet.ranks} {skill.ranks}
                  <span className={overMax ? "text-red-400" : ""}>/{skill.maxRanks}</span>
                </span>
              </button>
              <span className="w-10 text-right font-mono font-semibold">
                {skill.usable ? fmtMod(skill.total.total) : "—"}
              </span>
              <GhostButton
                onClick={() =>
                  save((c) => {
                    const current = c.skillRanks[skill.skillId] ?? 0;
                    const next = current - (skill.isClassSkill ? 1 : 0.5);
                    if (next <= 0) delete c.skillRanks[skill.skillId];
                    else c.skillRanks[skill.skillId] = next;
                  })
                }
              >
                −
              </GhostButton>
              <GhostButton
                onClick={() =>
                  save((c) => {
                    const current = c.skillRanks[skill.skillId] ?? 0;
                    c.skillRanks[skill.skillId] = current + (skill.isClassSkill ? 1 : 0.5);
                  })
                }
              >
                +
              </GhostButton>
              <GhostButton
                disabled={!skill.usable}
                onClick={() =>
                  roll(
                    `1d20${skill.total.total >= 0 ? "+" : ""}${skill.total.total}`,
                    `${character.name}: ${skill.name}`,
                  )
                }
              >
                🎲
              </GhostButton>
            </li>
          );
        })}
      </ul>
      <p className="mt-2 text-xs text-slate-500">
        Fertigkeitspunkte: {sheet.skillPoints.spent}/{sheet.skillPoints.available} · ● ={" "}
        {S.sheet.classSkill} · klassenfremde Ränge kosten 2 Punkte (halbe Ränge)
      </p>
    </Card>
  );
}

function NumberField(props: { label: string; value: number; onChange: (value: number) => void }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs uppercase text-slate-400">{props.label}</span>
      <input
        type="number"
        value={props.value}
        onChange={(e) => props.onChange(e.target.valueAsNumber || 0)}
        className="w-full rounded-lg border border-slate-700 bg-slate-900 px-2 py-1.5"
      />
    </label>
  );
}
