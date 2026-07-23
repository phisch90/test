# test

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
