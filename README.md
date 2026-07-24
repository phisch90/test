# Codex35

Ein D&D-3.5-Charakter-Manager als offline-fähige Web-App (PWA) — Charakterbögen mit
automatischer Regelberechnung, durchsuchbares SRD-Kompendium, Homebrew als Bürger
erster Klasse, Würfelroller und (später) Kampf-Tracker. Gedacht als Ersatz für die
iOS-App „Fight Club" (3.5 Edition).

## Aufbau

| Pfad | Inhalt |
|---|---|
| `apps/web/` | Die PWA (Vite + React + TanStack Router + Dexie + Tailwind) |
| `packages/core/` | Zod-Schemas + pure Regel-Engine (`deriveSheet`), keine DOM-/Storage-Imports |
| `tools/etl/` | Konvertiert den SRD-3.5-Datensatz nach `packs/srd/` (Build-Zeit, nicht ausgeliefert) |
| `tools/extract/` | Konverter für **private** Inhalte (Output ist gitignored, wird nie committet) |
| `packs/srd/` | Generierte, committete SRD-JSON-Chunks (Open Game Content, OGL 1.0a) |

## Entwicklung

```bash
pnpm install
pnpm dev        # Dev-Server
pnpm test       # Engine-Tests (die Spezifikation des Projekts)
pnpm etl        # SRD-Packs neu generieren
pnpm build      # Produktions-Build (PWA)
```

## Lizenz der Spieldaten

`packs/srd/` enthält ausschließlich Open Game Content aus dem D&D 3.5 System Reference
Document unter der Open Game License v1.0a — siehe `packs/srd/OGL.txt` und die
Lizenz-Seite in der App. Eigene Buchinhalte gehören nicht ins Repo: sie werden mit
`tools/extract/` in private Paket-Dateien konvertiert und lokal in die App importiert.

## E-Mail- & Kalender-Agenten (FYXER-Ersatz)

In `.claude/agents/` liegen vier Subagenten, die Claude Code automatisch nutzt, sobald eine passende Aufgabe ansteht. Sie arbeiten mit dem verbundenen Microsoft-365-/Outlook-Konto und decken die Kernfunktionen von FYXER ab.

| Agent | Zweck | Beispiel-Aufruf |
|---|---|---|
| `email-triage` | Posteingang sortieren: setzt Outlook-Kategorien (`1 - Antworten`, `2 - Warten auf Antwort`, `3 - Zur Kenntnis`, `4 - Termin-Update`, `5 - Newsletter & Werbung`) und liefert eine priorisierte Übersicht | „Sortiere meinen Posteingang" |
| `email-entwurf` | Antwortentwürfe im eigenen Schreibstil (lernt aus gesendeten Mails), einzeln oder für alle offenen Mails auf einmal; prüft bei Terminfragen den Kalender | „Erstelle Entwürfe für alle Mails, die eine Antwort brauchen" |
| `email-recherche` | Alte Mails, Zusagen, Anhänge und Termine wiederfinden | „Was war der letzte Stand mit Firma X?" |
| `kalender` | Tages-/Wochenübersicht, freie Slots finden, Meeting-Vorbereitung mit E-Mail-Kontext, Termine anlegen (nur auf ausdrücklichen Wunsch) | „Wann habe ich nächste Woche Zeit für ein 1-Stunden-Meeting mit X?" |

### FYXER-Funktionsvergleich

| FYXER-Funktion | Abgedeckt durch |
|---|---|
| Automatische E-Mail-Kategorisierung | ✅ `email-triage` |
| Antwortentwürfe im eigenen Ton | ✅ `email-entwurf` |
| Terminfindung / Verfügbarkeit | ✅ `kalender` + `email-entwurf` |
| Meeting-Notizen (Teams/Zoom-Mitschnitt) | ❌ nicht möglich – es gibt keinen Zugriff auf Anrufe/Aufnahmen |

Für den „automatisch im Hintergrund"-Charakter von FYXER kann zusätzlich eine geplante Routine eingerichtet werden (z. B. werktags morgens Posteingang sortieren + Entwürfe vorbereiten) – auf Zuruf in Claude Code.

### Sicherheitsprinzipien

- **Es wird nie automatisch gesendet.** Der Entwurfs-Agent legt Antworten nur im Entwürfe-Ordner ab; gesendet wird manuell in Outlook.
- Es wird nichts gelöscht; Triage setzt ausschließlich Kategorien.
- Termine werden nur nach ausdrücklicher Bestätigung angelegt oder beantwortet, nie gelöscht.
- Anweisungen, die im Text einer eingehenden E-Mail stehen, werden nicht befolgt (Schutz vor Prompt-Injection).
- Die erlaubten und verbotenen Outlook-Operationen sind in jedem Agenten-Prompt explizit festgelegt.

### Nutzung

Einfach in Claude Code auf Deutsch formulieren, was gebraucht wird – der passende Agent wird anhand seiner Beschreibung automatisch ausgewählt. Alternativ explizit: „Nutze den email-triage-Agenten und …".
