/** Gemeinsame Helfer für alle Konverter. */

/** Slug-Konvention: lowercase, ASCII, Nicht-Alphanumerisches → "-". */
export function slugify(name: string): string {
  return name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function entityId(kind: string, name: string): string {
  return `srd:${kind}:${slugify(name)}`;
}

const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  mdash: "—",
  ndash: "–",
  times: "×",
  sect: "§",
  rsquo: "’",
  lsquo: "‘",
  rdquo: "”",
  ldquo: "“",
  hellip: "…",
  frac12: "1/2",
  frac14: "1/4",
  frac34: "3/4",
  deg: "°",
  copy: "©",
};

export function decodeEntities(text: string): string {
  return text.replace(/&(#x?[0-9a-fA-F]+|\w+);/g, (whole, body: string) => {
    if (body.startsWith("#x") || body.startsWith("#X")) {
      return String.fromCodePoint(parseInt(body.slice(2), 16));
    }
    if (body.startsWith("#")) {
      return String.fromCodePoint(parseInt(body.slice(1), 10));
    }
    return NAMED_ENTITIES[body] ?? whole;
  });
}

/** Zellen einer HTML-Tabellenzeile extrahieren (bereits ohne <table>-Kontext). */
function tableToText(tableHtml: string): string {
  const rows: string[] = [];
  for (const tr of tableHtml.match(/<tr\b[\s\S]*?<\/tr>/gi) ?? []) {
    const cells: string[] = [];
    for (const td of tr.match(/<t[dh]\b[\s\S]*?<\/t[dh]>/gi) ?? []) {
      const inner = td
        .replace(/^<t[dh]\b[^>]*>/i, "")
        .replace(/<\/t[dh]>$/i, "");
      cells.push(inlineToText(inner).replace(/\s+/g, " ").trim());
    }
    const line = cells.join(" | ").replace(/^[\s|]+$/, "");
    if (line.trim() !== "") rows.push(cells.join(" | ").trim());
  }
  return rows.join("\n");
}

/** Inline-Markup (b/i/br/…) nach Markdown-artigem Klartext. */
function inlineToText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/?(b|strong)\b[^>]*>/gi, "**")
    .replace(/<\/?(i|em)\b[^>]*>/gi, "*")
    .replace(/<[^>]+>/g, "");
}

/**
 * Einfaches HTML des Dumps → Klartext mit Absätzen.
 * <p>/<br> → Leerzeilen, <b>/<i> → ** / *, Tabellen → kompakte "a | b | c"-Zeilen.
 */
export function htmlToText(html: string | null | undefined): string {
  if (html == null) return "";
  let text = html;

  // Tabellen zuerst — als Block mit Zeilen "Zelle | Zelle".
  text = text.replace(/<table\b[\s\S]*?<\/table>/gi, (t) => `\n\n${tableToText(t)}\n\n`);

  // Listen
  text = text.replace(/<li\b[^>]*>/gi, "\n- ").replace(/<\/li>/gi, "");

  // Blockelemente → Absatzgrenzen
  text = text
    .replace(/<\/?(p|div|ul|ol|blockquote)\b[^>]*>/gi, "\n\n")
    .replace(/<\/?h[1-6]\b[^>]*>/gi, "\n\n");

  text = inlineToText(text);
  text = decodeEntities(text);

  // Leere Bold/Italic-Reste ("****", "**  **") entfernen
  text = text.replace(/\*\*\s*\*\*/g, " ").replace(/(^|\s)\*\s*\*(\s|$)/g, " ");

  // Whitespace normalisieren
  text = text
    .split("\n")
    .map((line) => line.replace(/[ \t]+/g, " ").trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return text;
}

/** "+6/+1" → 6, "+20/+15/+10/+5" → 20, null/"—" → 0. */
export function parseBonus(value: string | null | undefined): number {
  if (value == null) return 0;
  const m = /[+-]?\d+/.exec(value);
  return m ? parseInt(m[0], 10) : 0;
}

/** "d10" → 10. */
export function parseHitDie(value: string | null | undefined): number | null {
  if (value == null) return null;
  const m = /d(\d+)/i.exec(value);
  return m ? parseInt(m[1]!, 10) : null;
}

/** "15 gp" → 15, "5 sp" → 0.5, "1 cp" → 0.01, "1,000 gp" → 1000. Sonst undefined. */
export function parseCostGp(value: string | null | undefined): number | undefined {
  if (value == null) return undefined;
  const m = /^\s*([\d,]+(?:\.\d+)?|\d+\s*\/\s*\d+)\s*(gp|sp|cp)\s*$/i.exec(value);
  if (!m) return undefined;
  let amount: number;
  const raw = m[1]!.replace(/,/g, "");
  if (raw.includes("/")) {
    const [a, b] = raw.split("/").map((s) => parseFloat(s.trim()));
    amount = a! / b!;
  } else {
    amount = parseFloat(raw);
  }
  const unit = m[2]!.toLowerCase();
  if (unit === "sp") amount /= 10;
  if (unit === "cp") amount /= 100;
  return Math.round(amount * 10000) / 10000;
}

/** "4 lb." → 4, "1/2 lb." → 0.5. Sonst undefined. */
export function parseWeightLb(value: string | null | undefined): number | undefined {
  if (value == null) return undefined;
  const m = /^\s*(\d+(?:\.\d+)?|\d+\s*\/\s*\d+)\s*lbs?\.?\s*$/i.exec(value);
  if (!m) return undefined;
  const raw = m[1]!;
  if (raw.includes("/")) {
    const [a, b] = raw.split("/").map((s) => parseFloat(s.trim()));
    return a! / b!;
  }
  return parseFloat(raw);
}

/** "19-20/x2" → {critRange:"19-20", critMult:"x2"}; "x3" → {critRange:"20", critMult:"x3"}. */
export function parseCritical(value: string | null | undefined): { critRange: string; critMult: string } {
  if (value == null || value.trim() === "" || value.trim() === "-" || value.trim() === "—") {
    return { critRange: "20", critMult: "x2" };
  }
  const v = value.trim();
  const m = /^(\d+(?:-\d+)?)\s*\/\s*(.+)$/.exec(v);
  if (m) return { critRange: m[1]!, critMult: m[2]!.trim() };
  if (/^x\d/i.test(v)) return { critRange: "20", critMult: v };
  if (/^\d+-\d+$/.test(v)) return { critRange: v, critMult: "x2" };
  return { critRange: "20", critMult: v };
}

/** "10 ft." → 10. Sonst undefined. */
export function parseFeet(value: string | null | undefined): number | undefined {
  if (value == null) return undefined;
  const m = /^\s*(\d+)\s*ft\.?\s*$/i.exec(value);
  return m ? parseInt(m[1]!, 10) : undefined;
}

/** Kleiner Warnungs-Sammler, damit build.ts alles gebündelt ausgeben kann. */
export class Warnings {
  readonly items: string[] = [];
  add(message: string): void {
    this.items.push(message);
  }
}
