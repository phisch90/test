import { useDiceStore } from "../lib/diceStore.js";
import { BottomSheet } from "./bits.js";

/** Globales Ergebnis-Sheet: jeder tap-to-roll landet hier. */
export function DiceResultSheet() {
  const { latest, sheetOpen, closeSheet, roll } = useDiceStore();
  if (!latest) return null;
  const { result } = latest;
  return (
    <BottomSheet open={sheetOpen} onClose={closeSheet} title={latest.label ?? result.expression}>
      <div className="text-center">
        <div className="text-5xl font-bold">{result.total}</div>
        <div className="mt-2 text-sm text-slate-400">
          {result.rolls.map((roll, i) => (
            <span key={i} className="mr-2">
              {roll.sign < 0 ? "−" : ""}d{roll.sides}: [{roll.values.join(", ")}]
            </span>
          ))}
          {result.modifier !== 0 && (
            <span>
              {result.modifier > 0 ? "+" : ""}
              {result.modifier}
            </span>
          )}
        </div>
        <button
          onClick={() => roll(result.expression, latest.label)}
          className="mt-4 w-full rounded-lg border border-slate-600 py-2 text-sm hover:bg-slate-800"
        >
          🎲 Nochmal würfeln
        </button>
      </div>
    </BottomSheet>
  );
}
