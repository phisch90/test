import { create } from "zustand";
import { parseDice, rollDice, type RollResult } from "@codex35/core";
import { cryptoRng } from "./rng.js";

export interface DiceEntry {
  id: string;
  label: string | undefined;
  result: RollResult;
  at: number;
}

interface DiceState {
  history: DiceEntry[];
  /** Letzter Wurf — im globalen Bottom-Sheet angezeigt. */
  latest: DiceEntry | null;
  sheetOpen: boolean;
  roll: (expression: string, label?: string) => DiceEntry | null;
  closeSheet: () => void;
}

export const useDiceStore = create<DiceState>((set, get) => ({
  history: [],
  latest: null,
  sheetOpen: false,

  roll: (expression, label) => {
    const parsed = parseDice(expression);
    if (!parsed) return null;
    const entry: DiceEntry = {
      id: crypto.randomUUID(),
      label,
      result: rollDice(parsed, cryptoRng),
      at: Date.now(),
    };
    set({
      history: [entry, ...get().history].slice(0, 100),
      latest: entry,
      sheetOpen: true,
    });
    return entry;
  },

  closeSheet: () => set({ sheetOpen: false }),
}));
