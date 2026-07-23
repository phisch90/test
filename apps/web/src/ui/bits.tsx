import type { ReactNode } from "react";

export function Card(props: { children: ReactNode; className?: string }) {
  return (
    <div
      className={`rounded-xl border border-slate-700/60 bg-slate-900/70 p-3 shadow-sm ${props.className ?? ""}`}
    >
      {props.children}
    </div>
  );
}

export function SectionTitle(props: { children: ReactNode }) {
  return (
    <h2 className="mb-2 text-xs font-semibold uppercase tracking-widest text-slate-400">
      {props.children}
    </h2>
  );
}

export function fmtMod(value: number): string {
  return value >= 0 ? `+${value}` : `${value}`;
}

/**
 * Antippbarer Wert — das zentrale Interaktionsmuster des Bogens:
 * kurzer Tap öffnet den Breakdown, „Würfeln"-Knopf daneben rollt 1d20+X.
 */
export function StatButton(props: {
  label: string;
  value: string;
  onClick?: () => void;
  big?: boolean;
}) {
  return (
    <button
      onClick={props.onClick}
      className="flex min-w-16 flex-col items-center rounded-lg border border-slate-700/60 bg-slate-800/60 px-2 py-1.5 text-center transition-colors active:bg-slate-700"
    >
      <span className={props.big ? "text-2xl font-bold" : "text-lg font-semibold"}>
        {props.value}
      </span>
      <span className="text-[10px] uppercase tracking-wide text-slate-400">{props.label}</span>
    </button>
  );
}

/** Bottom-Sheet, mobil-first; auf Desktop mittig als Dialog. */
export function BottomSheet(props: {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
}) {
  if (!props.open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" role="dialog">
      <div className="absolute inset-0 bg-black/60" onClick={props.onClose} />
      <div className="relative max-h-[80vh] w-full overflow-y-auto rounded-t-2xl border border-slate-700 bg-slate-900 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:max-w-lg sm:rounded-2xl">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-base font-semibold">{props.title}</h3>
          <button
            onClick={props.onClose}
            className="rounded-full px-3 py-1 text-slate-400 hover:bg-slate-800"
            aria-label="Schließen"
          >
            ✕
          </button>
        </div>
        {props.children}
      </div>
    </div>
  );
}

export function SearchInput(props: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <input
      type="search"
      value={props.value}
      onChange={(e) => props.onChange(e.target.value)}
      placeholder={props.placeholder}
      className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm placeholder:text-slate-500 focus:border-amber-500 focus:outline-none"
    />
  );
}

export function PrimaryButton(props: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  type?: "button" | "submit";
}) {
  return (
    <button
      type={props.type ?? "button"}
      onClick={props.onClick}
      disabled={props.disabled}
      className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white shadow enabled:hover:bg-amber-500 disabled:opacity-40"
    >
      {props.children}
    </button>
  );
}

export function GhostButton(props: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={props.onClick}
      disabled={props.disabled}
      className={`rounded-lg border px-3 py-1.5 text-sm disabled:opacity-40 ${
        props.danger
          ? "border-red-700 text-red-400 enabled:hover:bg-red-950"
          : "border-slate-600 text-slate-200 enabled:hover:bg-slate-800"
      }`}
    >
      {props.children}
    </button>
  );
}

export function Chip(props: { children: ReactNode; active?: boolean; onClick?: () => void }) {
  return (
    <button
      type="button"
      onClick={props.onClick}
      className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
        props.active
          ? "border-amber-500 bg-amber-600/20 text-amber-300"
          : "border-slate-600 text-slate-300 hover:bg-slate-800"
      }`}
    >
      {props.children}
    </button>
  );
}
