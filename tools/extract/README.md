# tools/extract — private Inhalte (NICHT committen!)

Hier entstehen Konverter, die **eigene Buchinhalte** (PDFs, Excel-Listen) in private
Kompendium-Pakete verwandeln — JSON-Dateien im Homebrew-Format, die in der App
importiert werden (Einstellungen → Import).

**Wichtig:** Der Output (`out/`, `private/`, `*.private.json`) ist per `.gitignore`
ausgeschlossen und darf nie ins Repo oder in den App-Build gelangen. Die Original-
Bücher sind urheberrechtlich geschützt; die Pakete sind nur für den privaten
Gebrauch der Gruppe bestimmt und leben z.B. im OneDrive neben den PDFs.

Geplante Konverter (Phase 2+):

1. **Excel-Zauberliste** („Halbling Druide.xlsx") → deutsches Übersetzungs-Overlay
   (`localized.de.summary`) für die SRD-Zauber
2. **Complete-Bände (PDF)** → Feats/Prestigeklassen/Zauber als Homebrew-Pakete
   je Buch (halbautomatisch mit Review)
