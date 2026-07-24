import type { Database } from "./parse-sql.js";
import { Warnings } from "./util.js";

/** Gemeinsamer Konverter-Kontext: geparster Dump + Lookups + Warnungssammler. */
export interface ConvertContext {
  db: Database;
  /** lowercase Skill-Name → Entity-ID (z.B. "move silently" → srd:skill:move-silently). */
  skillIdByName: Map<string, string>;
  /** lowercase Feat-Name → Entity-ID (alle Feats des Dumps, auch psionische). */
  featIdByName: Map<string, string>;
  /** lowercase Domänen-Namen (aus der domain-Tabelle). */
  domainNames: Set<string>;
  warnings: Warnings;
}

/** Kommasplit, der Klammern respektiert: "Knowledge (all skills, taken individually), Ride" → 2 Teile. */
export function splitTopLevel(text: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let current = "";
  for (const ch of text) {
    if (ch === "(" || ch === "[") depth++;
    else if (ch === ")" || ch === "]") depth = Math.max(0, depth - 1);
    if (ch === "," && depth === 0) {
      parts.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }
  if (current.trim() !== "") parts.push(current.trim());
  return parts.filter((p) => p !== "");
}
