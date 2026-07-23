import { useEffect, useState } from "react";
import { Link, Outlet, useRouterState } from "@tanstack/react-router";
import { S } from "../strings.js";
import { ensureSeeded, requestPersistentStorage } from "../db/seed.js";
import { DiceResultSheet } from "./DiceSheet.js";

const NAV = [
  { to: "/", label: S.nav.characters, icon: "🛡️" },
  { to: "/kompendium", label: S.nav.compendium, icon: "📖" },
  { to: "/wuerfel", label: S.nav.dice, icon: "🎲" },
  { to: "/einstellungen", label: S.nav.settings, icon: "⚙️" },
] as const;

export function Layout() {
  const [seedMessage, setSeedMessage] = useState<string | null>(S.misc.seedRunning);
  const pathname = useRouterState({ select: (state) => state.location.pathname });

  useEffect(() => {
    void requestPersistentStorage();
    ensureSeeded(setSeedMessage)
      .then(() => setSeedMessage(null))
      .catch((error: unknown) => {
        console.error(error);
        setSeedMessage(null); // App bleibt nutzbar, Kompendium ggf. leer.
      });
  }, []);

  const isActive = (to: string) => (to === "/" ? pathname === "/" : pathname.startsWith(to));

  return (
    <div className="flex h-full flex-col md:flex-row">
      {/* Sidebar ≥md */}
      <nav className="hidden w-52 shrink-0 flex-col gap-1 border-r border-slate-800 p-3 md:flex">
        <div className="mb-4 px-2 text-lg font-bold tracking-tight text-amber-400">
          {S.appName}
        </div>
        {NAV.map((item) => (
          <Link
            key={item.to}
            to={item.to}
            className={`rounded-lg px-3 py-2 text-sm font-medium ${
              isActive(item.to) ? "bg-amber-600/20 text-amber-300" : "text-slate-300 hover:bg-slate-800"
            }`}
          >
            <span className="mr-2">{item.icon}</span>
            {item.label}
          </Link>
        ))}
      </nav>

      <main className="flex-1 overflow-y-auto pb-20 md:pb-4">
        {seedMessage && (
          <div className="bg-amber-900/40 px-4 py-2 text-center text-xs text-amber-200">
            {seedMessage}
          </div>
        )}
        <div className="mx-auto max-w-3xl p-3 sm:p-4">
          <Outlet />
        </div>
      </main>

      {/* Bottom-Tabs mobil */}
      <nav className="fixed inset-x-0 bottom-0 z-40 flex border-t border-slate-800 bg-slate-950/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
        {NAV.map((item) => (
          <Link
            key={item.to}
            to={item.to}
            className={`flex flex-1 flex-col items-center py-2 text-[11px] ${
              isActive(item.to) ? "text-amber-400" : "text-slate-400"
            }`}
          >
            <span className="text-lg leading-none">{item.icon}</span>
            {item.label}
          </Link>
        ))}
      </nav>

      <DiceResultSheet />
    </div>
  );
}
