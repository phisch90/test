import { useState } from "react";
import { parseDice } from "@codex35/core";
import { S } from "../strings.js";
import { useDiceStore } from "../lib/diceStore.js";
import { Card, PrimaryButton, SectionTitle } from "../ui/bits.js";

const QUICK = ["1d20", "1d20+5", "2d6", "1d8", "1d4", "1d100"];

export function DicePage() {
  const [input, setInput] = useState("");
  const { roll, history } = useDiceStore();
  const valid = input.trim() === "" || parseDice(input) !== null;

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">{S.dice.title}</h1>

      <Card>
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (parseDice(input)) roll(input);
          }}
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={S.dice.placeholder}
            className={`flex-1 rounded-lg border bg-slate-900 px-3 py-2 font-mono text-sm focus:outline-none ${
              valid ? "border-slate-700 focus:border-amber-500" : "border-red-600"
            }`}
          />
          <PrimaryButton type="submit" disabled={!parseDice(input)}>
            🎲 {S.actions.roll}
          </PrimaryButton>
        </form>
        {!valid && <p className="mt-1 text-xs text-red-400">{S.dice.invalid}</p>}
        <div className="mt-3 flex flex-wrap gap-2">
          {QUICK.map((expr) => (
            <button
              key={expr}
              onClick={() => roll(expr)}
              className="rounded-full border border-slate-600 px-3 py-1 font-mono text-xs hover:bg-slate-800"
            >
              {expr}
            </button>
          ))}
        </div>
      </Card>

      <div>
        <SectionTitle>{S.dice.history}</SectionTitle>
        <ul className="space-y-1">
          {history.map((entry) => (
            <li
              key={entry.id}
              className="flex items-baseline justify-between rounded-lg bg-slate-900/60 px-3 py-2 text-sm"
            >
              <span className="text-slate-300">
                {entry.label ? `${entry.label} · ` : ""}
                <span className="font-mono text-slate-400">{entry.result.expression}</span>
              </span>
              <span className="text-lg font-bold">{entry.result.total}</span>
            </li>
          ))}
          {history.length === 0 && <li className="text-sm text-slate-500">Noch keine Würfe.</li>}
        </ul>
      </div>
    </div>
  );
}
