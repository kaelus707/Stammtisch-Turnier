# Stammtisch-Turnier SV Saaldorf

Live-Seite fürs Stammtischturnier: https://kaelus707.github.io/Stammtisch-Turnier/

## Für den Veranstalter

1. `vorlage/stammtisch-turnier.xlsx` in Google Drive hochladen und mit Google Tabellen öffnen
   (Datei → Als Google Tabellen speichern).
2. Freigeben → „Jeder mit dem Link“ → **Betrachter**.
3. Die ID aus der Adresse (`/d/<ID>/edit`) in `src/data/config.ts` bei `SHEET_ID` eintragen und pushen.
4. Am Turniertag nur noch Teams, Ergebnisse und Torschützen eintragen.
   Die Seite aktualisiert sich alle 30 Sekunden selbst.

Blattnamen und Spaltenüberschriften nicht ändern.

- Ergebnisse nur im Blatt `Spielplan` in die gelben Spalten `Tore A` und `Tore B` eintragen, zwei Zahlen in zwei Zellen (nie `6:5` in eine Zelle – Google Tabellen macht daraus eine Uhrzeit). K.-o.-Spiele mit Neunmeterschießen als Gesamtergebnis inklusive Neunmeter, z. B. `6` und `5`.
- Teamnamen stehen im Blatt `Teams` in der Spalte `Team`, ein Los bei Bedarf in `Los`. `Code` und `Gruppe` nicht ändern.
- Alles andere rechnet die Tabelle selbst: Gruppen A/B, K.-o.-Paarungen, Turnierbaum und Endplatzierung. Die Webseite zeigt es nur an. Graue Rechenhilfe und Formelzellen nicht überschreiben.

### Nach dem Upload prüfen

1. Die Zeiten im Spielplan beginnen mit der Startzeit.
2. Nach dem Eintragen von zwei Test-Ergebnissen erscheinen die Sieger und die Gruppentabelle ändert sich.
3. Ist eine Gruppe vollständig eingetragen, steht im Halbfinale ein echter Teamname.
4. Die Webseite zeigt nach höchstens 30 s dieselbe Tabelle.
5. Test-Ergebnisse wieder löschen.

## Entwicklung

    npm install
    npm run dev        # http://localhost:5173/Stammtisch-Turnier/ (ohne SHEET_ID mit Demo-Daten)
    npm test
    npm run check
    npm run template   # Vorlage neu erzeugen
    npm run demo       # Demo-CSVs aus der Vorlage neu rechnen

Einmalig im Repo: Repository öffentlich stellen und unter Settings → Pages → Source „GitHub Actions“ wählen.
