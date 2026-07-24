/**
 * Minimaler Parser für den Andargor-MySQL-4.0-Dump (srd-db-v1.3.sql).
 *
 * Der Dump enthält ein INSERT-Statement pro Zeile:
 *   INSERT INTO <table> VALUES (v1,v2,...);
 * Strings sind einfach gequotet mit Backslash-Escapes (\' \\ \n \r \t ...).
 * Spaltennamen werden aus den CREATE-TABLE-Blöcken gelesen.
 */

export type Row = Record<string, string | null>;

export interface Table {
  name: string;
  columns: string[];
  rows: Row[];
}

export type Database = Map<string, Table>;

/** Spaltennamen aus einem CREATE-TABLE-Body ziehen. */
function parseColumns(body: string): string[] {
  const columns: string[] = [];
  for (const rawLine of body.split("\n")) {
    const line = rawLine.trim();
    if (line === "" || line.startsWith("PRIMARY KEY") || line.startsWith("KEY") || line.startsWith("UNIQUE")) {
      continue;
    }
    const m = /^`?(\w+)`?\s/.exec(line);
    if (m?.[1]) columns.push(m[1]);
  }
  return columns;
}

/**
 * Werteliste eines INSERT-Statements parsen.
 * `input` ist der Text zwischen den äußeren Klammern.
 */
export function parseValueTuple(input: string): (string | null)[] {
  const values: (string | null)[] = [];
  let i = 0;
  const n = input.length;

  while (i < n) {
    // Whitespace/Kommas überspringen
    while (i < n && (input[i] === "," || input[i] === " ")) i++;
    if (i >= n) break;

    if (input.startsWith("NULL", i)) {
      values.push(null);
      i += 4;
      continue;
    }

    if (input[i] === "'") {
      i++; // öffnendes Quote
      let out = "";
      while (i < n) {
        const ch = input[i];
        if (ch === "\\") {
          const next = input[i + 1];
          switch (next) {
            case "n": out += "\n"; break;
            case "r": out += "\r"; break;
            case "t": out += "\t"; break;
            case "0": out += "\0"; break;
            case "Z": out += ""; break;
            case "'": out += "'"; break;
            case '"': out += '"'; break;
            case "\\": out += "\\"; break;
            default: out += next ?? "";
          }
          i += 2;
          continue;
        }
        if (ch === "'") {
          // '' = escaped Quote (nur wenn direkt ein weiteres Quote folgt)
          if (input[i + 1] === "'") {
            out += "'";
            i += 2;
            continue;
          }
          i++; // schließendes Quote
          break;
        }
        out += ch;
        i++;
      }
      values.push(out);
      continue;
    }

    // Zahl / bare token bis zum nächsten Komma
    let end = i;
    while (end < n && input[end] !== ",") end++;
    values.push(input.slice(i, end).trim());
    i = end;
  }

  return values;
}

/** Kompletten Dump parsen. */
export function parseSqlDump(sql: string): Database {
  const db: Database = new Map();

  // CREATE TABLE Blöcke
  const createRe = /CREATE TABLE `?(\w+)`? \(([\s\S]*?)\n\) TYPE=MyISAM;/g;
  for (const m of sql.matchAll(createRe)) {
    const name = m[1]!;
    db.set(name, { name, columns: parseColumns(m[2]!), rows: [] });
  }

  // INSERT-Zeilen (eine pro Zeile im Dump)
  const insertRe = /^INSERT INTO `?(\w+)`? VALUES \((.*)\);\r?$/gm;
  for (const m of sql.matchAll(insertRe)) {
    const table = db.get(m[1]!);
    if (!table) throw new Error(`INSERT für unbekannte Tabelle: ${m[1]}`);
    const values = parseValueTuple(m[2]!);
    if (values.length !== table.columns.length) {
      throw new Error(
        `Spaltenzahl passt nicht in ${table.name}: erwartet ${table.columns.length}, bekommen ${values.length} — Zeile: ${m[0].slice(0, 120)}…`,
      );
    }
    const row: Row = {};
    table.columns.forEach((col, idx) => {
      row[col] = values[idx] ?? null;
    });
    table.rows.push(row);
  }

  return db;
}

/** Tabelle holen oder mit klarer Meldung scheitern. */
export function requireTable(db: Database, name: string): Table {
  const table = db.get(name);
  if (!table) throw new Error(`Tabelle fehlt im Dump: ${name}`);
  return table;
}
