# Stammtisch-Turnier SV Saaldorf

Live-Seite fürs Stammtischturnier: https://kaelus707.github.io/Stammtisch-Turnier/

## Für den Veranstalter

1. `vorlage/stammtisch-turnier.xlsx` in Google Drive hochladen und mit Google Tabellen öffnen
   (Datei → Als Google Tabellen speichern).
2. Freigeben → „Jeder mit dem Link“ → **Betrachter**.
3. Die ID aus der Adresse (`/d/<ID>/edit`) in `src/data/config.ts` bei `SHEET_ID` eintragen und pushen.
4. Am Turniertag nur noch Teams, Ergebnisse (`Tore Heim`/`Tore Gast`) und Torschützen eintragen.
   Die Seite aktualisiert sich alle 30 Sekunden selbst.

Blattnamen und Spaltenüberschriften nicht ändern. K.-o.-Spiele mit Neunmeterschießen als Gesamtergebnis eintragen, z. B. `6:5`.

## Entwicklung

    npm install
    npm run dev        # http://localhost:5173/Stammtisch-Turnier/ (ohne SHEET_ID mit Demo-Daten)
    npm test
    npm run check
    npm run template   # Vorlage neu erzeugen

Einmalig im Repo: Repository öffentlich stellen und unter Settings → Pages → Source „GitHub Actions“ wählen.
