import type { StatValue } from "@codex35/core";
import { S } from "../strings.js";
import { BottomSheet, fmtMod } from "./bits.js";

/**
 * DAS Vertrauens-Feature: jeder abgeleitete Wert zeigt auf Tap seine
 * Zusammensetzung — inklusive überdeckter Boni („wirkt nicht") und
 * situativer Beiträge. Wird nie gestrichen.
 */
export function BreakdownSheet(props: {
  open: boolean;
  onClose: () => void;
  title: string;
  value: StatValue | null;
  onRoll?: (() => void) | undefined;
}) {
  const { value } = props;
  return (
    <BottomSheet open={props.open} onClose={props.onClose} title={props.title}>
      {value && (
        <>
          <div className="mb-3 text-center text-4xl font-bold">{fmtMod(value.total)}</div>
          <ul className="divide-y divide-slate-800">
            {value.contributions.map((c, i) => (
              <li key={i} className="flex items-baseline justify-between gap-2 py-1.5 text-sm">
                <div className={c.applied ? "" : "text-slate-500"}>
                  <span className={c.applied ? "" : "line-through"}>{c.source}</span>
                  <span className="ml-1 text-xs text-slate-500">({c.bonusType})</span>
                  {c.condition && (
                    <div className="text-xs text-sky-400">situativ: {c.condition}</div>
                  )}
                  {!c.applied && !c.condition && (
                    <div className="text-xs text-slate-500">{S.sheet.breakdownSuppressed}</div>
                  )}
                </div>
                <span
                  className={`font-mono ${c.applied ? "" : "text-slate-500 line-through"}`}
                >
                  {fmtMod(c.value)}
                </span>
              </li>
            ))}
            {value.contributions.length === 0 && (
              <li className="py-2 text-sm text-slate-500">Keine Beiträge.</li>
            )}
          </ul>
          {props.onRoll && (
            <button
              onClick={props.onRoll}
              className="mt-3 w-full rounded-lg bg-amber-600 py-2 font-semibold text-white hover:bg-amber-500"
            >
              🎲 {S.actions.roll} (1d20{value.total >= 0 ? "+" : ""}
              {value.total})
            </button>
          )}
        </>
      )}
    </BottomSheet>
  );
}
