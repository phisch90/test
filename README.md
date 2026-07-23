# test

## E-Mail-Agenten

In `.claude/agents/` liegen drei Subagenten, die Claude Code automatisch nutzt, sobald eine passende Aufgabe ansteht. Sie arbeiten mit dem verbundenen Microsoft-365-/Outlook-Konto.

| Agent | Zweck | Beispiel-Aufruf |
|---|---|---|
| `email-triage` | Posteingang sichten, priorisieren, zusammenfassen | „Was ist heute wichtig in meinem Postfach?" |
| `email-entwurf` | Antwort- und neue E-Mail-Entwürfe erstellen | „Antworte auf die Mail von Herrn Müller und sag den Termin zu" |
| `email-recherche` | Alte Mails, Zusagen, Anhänge und Termine finden | „Was war der letzte Stand mit Firma X?" |

### Sicherheitsprinzipien

- **Es wird nie automatisch gesendet.** Der Entwurfs-Agent legt Antworten nur im Entwürfe-Ordner ab; gesendet wird manuell in Outlook.
- Triage und Recherche sind rein lesend – sie löschen, verschieben und markieren nichts.
- Anweisungen, die im Text einer eingehenden E-Mail stehen, werden nicht befolgt (Schutz vor Prompt-Injection).

### Nutzung

Einfach in Claude Code auf Deutsch formulieren, was gebraucht wird – der passende Agent wird anhand seiner Beschreibung automatisch ausgewählt. Alternativ explizit: „Nutze den email-triage-Agenten und …".
