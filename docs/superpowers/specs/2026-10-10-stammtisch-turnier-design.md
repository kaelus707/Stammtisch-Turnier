# Stammtisch-Turnier – Design-Spec

**Datum:** 2026-10-10
**Status:** Entwurf zur Freigabe

## 1. Ziel

Eine öffentliche, schreibgeschützte Webseite für das Stammtischturnier des SV Saaldorf (Hallenfußball). Zuschauer und Spieler sehen auf dem Handy jederzeit das aktuelle Spiel, den Spielplan, die Tabellen, die Finalrunde, die Pausen ihres Teams und die Torschützenliste. Alle Daten pflegt der Veranstalter in einer öffentlich (nur lesend) freigegebenen Google-Tabelle. Die Webseite liest sie direkt aus.

**Erfolgskriterien**
- Ein Ergebnis, das in der Tabelle eingetragen wird, erscheint spätestens nach rund 30–60 s auf der Seite.
- Tabelle, Finalrunden-Paarungen und Uhrzeiten werden vollständig automatisch berechnet.
- Die Seite ist auf dem Handy (ab 360 px Breite) gut bedienbar.
- Es gibt keine laufenden Kosten, keinen Server und keine API-Schlüssel.

**Nicht im Umfang (YAGNI)**
- Admin-Login oder Bearbeitung auf der Webseite.
- Live-Zwischenstände während eines Spiels.
- Torschützen pro Spiel (nur Gesamttore pro Spieler).
- TV-/Beamer-Ansicht. Sie ist für später vorgesehen. Die Komponenten werden wiederverwendbar gebaut, die Ansicht selbst wird nicht umgesetzt.

## 2. Turniermodus

- 10 Teams in 2 Gruppen (A, B) zu je 5 Teams. Gespielt wird auf einem Feld, also nacheinander.
- **Gruppenphase:** In jeder Gruppe spielt jeder gegen jeden, das sind 10 Spiele pro Gruppe. Die Spiele 1–20 wechseln zwischen A und B (A, B, A, B, …). Die Reihenfolge innerhalb einer Gruppe ist so gewählt, dass kein Team zwei Gruppenspiele direkt hintereinander hat und die Pausen möglichst gleichmäßig verteilt sind.
- **Punkte:** Sieg 3, Unentschieden 1, Niederlage 0.
- **Tabellenreihenfolge:**
  1. Punkte
  2. Tordifferenz
  3. Direkter Vergleich: eine Mini-Tabelle nur aus den Spielen der punkt- und tordifferenzgleichen Teams untereinander, sortiert nach Punkten, dann nach Tordifferenz in diesen Spielen
  4. Mehr geschossene Tore (gesamt)
  5. Los: Wert aus Spalte `Los` im Blatt `Teams`, kleinere Zahl gleich besserer Platz

  Bleiben Teams nach Stufe 4 gleich und fehlt bei mindestens einem der Los-Wert, gilt deren Platz als „Los ausstehend“.
- **Finalrunde** (Spiele 21–27, in dieser Reihenfolge):

  | Nr. | Runde | Heim | Gast |
  |---|---|---|---|
  | 21 | Spiel um Platz 9 | A5 | B5 |
  | 22 | Halbfinale 1 | A1 | B2 |
  | 23 | Spiel um Platz 7 | A4 | B4 |
  | 24 | Halbfinale 2 | A2 | B1 |
  | 25 | Spiel um Platz 5 | A3 | B3 |
  | 26 | Spiel um Platz 3 | Verlierer HF1 | Verlierer HF2 |
  | 27 | Finale | Sieger HF1 | Sieger HF2 |

- **K.-o.-Spiele** gehen bei Gleichstand ins Neunmeterschießen. Eingetragen wird nur das Gesamtergebnis inklusive Neunmeter, z. B. `6:5`. Steht trotzdem ein Unentschieden drin, gilt der Sieger als unbestimmt, und die Seite zeigt einen Hinweis.
- **Endstand:** Die Plätze 1–10 ergeben sich aus den Finalrundenspielen.

## 3. Datenquelle: Google-Tabelle

Die Freigabe steht auf „Jeder mit dem Link kann ansehen“. Gelesen wird jedes Blatt über
`https://docs.google.com/spreadsheets/d/<SHEET_ID>/gviz/tq?tqx=out:csv&sheet=<Blattname>`.
Die Sheet-ID steht in `src/data/config.ts`. Formeln in der Tabelle werden als berechnete Werte exportiert.

### Blatt `Einstellungen` (Spalten: Feld | Wert)
| Feld | Beispiel | Pflicht |
|---|---|---|
| Turniername | Stammtischturnier 2026 | ja |
| Datum | 14.11.2026 | ja |
| Startzeit | 14:00 | ja |
| Spieldauer (Min.) | 10 | ja |
| Pause (Min.) | 2 | ja (Standard 2) |

### Blatt `Teams`
| Team | Gruppe | Los |
|---|---|---|
| Name | `A` oder `B` | optional, Ganzzahl |

### Blatt `Spielplan`
| Nr. | Runde | Heim | Gast | Tore Heim | Tore Gast |
|---|---|---|---|---|---|

- Spiele 1–20: In `Runde` steht `Gruppe A` oder `Gruppe B`. `Heim` und `Gast` sind Formeln auf das Blatt `Teams`, damit eine Umbenennung überall wirkt.
- Spiele 21–27: In `Runde` steht der Name laut Tabelle oben. `Heim` und `Gast` enthalten die Platzhalter `A1`–`A5`, `B1`–`B5`, `Sieger HF1`, `Sieger HF2`, `Verlierer HF1` und `Verlierer HF2`.
- Ein Spiel gilt als **beendet**, wenn `Tore Heim` und `Tore Gast` beide eine Ganzzahl ≥ 0 enthalten.
- Reihenfolge und Paarungen darf der Veranstalter von Hand ändern. Maßgeblich ist die Spalte `Nr.`.

### Blatt `Spieler`
| Name | Team | Tore |
|---|---|---|

`Tore` ist die Gesamtzahl. Ein leeres Feld zählt als 0.

### Vorlage
Ein Skript (`tools/template.ts`, ausgeführt mit `npm run template`) erzeugt `vorlage/stammtisch-turnier.xlsx` mit allen vier Blättern, Beispielteams `Team A1`…`Team B5`, Formeln in `Spielplan` und dem kompletten Spielplan (27 Spiele). Der Veranstalter lädt die Datei in Google Drive hoch und öffnet sie mit Google Tabellen.

## 4. Berechnungen

- **Geplante Uhrzeit** von Spiel n (n = Position in der nach `Nr.` sortierten Liste, beginnend bei 0): `Startzeit + n × (Spieldauer + Pause)`.
- **Live-Spiel:** das erste Spiel (nach `Nr.`) ohne Ergebnis. Gibt es keines, ist das Turnier beendet.
- **Als Nächstes:** die zwei Spiele nach dem Live-Spiel.
- **Pausen-Übersicht** pro Team, bezogen auf den Index L des Live-Spiels und den Index k des nächsten offenen Spiels des Teams (Platzhalter werden vorher so weit wie möglich aufgelöst):
  - k = L → „spielt jetzt“
  - k = L + 1 → „nächstes Spiel“
  - k > L + 1 → „noch (k − L − 1) Spiele Pause“ (bei 1: „noch 1 Spiel Pause“), dazu die geplante Uhrzeit von Spiel k
  - kein offenes Spiel bekannt, aber noch ungelöste Platzhalter → „wartet auf Finalrunde“
  - kein offenes Spiel mehr → „fertig“ (mit Endplatz, falls bekannt)
  - Sortierung: aufsteigend nach k, fertige Teams am Ende
- **Platzhalter-Auflösung:** `A1`–`B5` werden erst aufgelöst, wenn alle Spiele der Gruppe beendet sind und der Platz eindeutig ist. `Sieger/Verlierer HFx` wird aufgelöst, sobald das Halbfinale einen Sieger hat.
- **Torschützen:** absteigend nach Toren, danach alphabetisch. Bei gleicher Toranzahl gilt der gleiche Rang (1, 2, 2, 4). Spieler mit 0 Toren werden nicht angezeigt.

## 5. Seitenaufbau (Mobile-first)

Es ist eine Single-Page-App mit fester **Navigation unten** (5 Tabs) und einem **Kopfbereich** mit Wappen, Turniername, Datum und „aktualisiert vor X s“.

1. **Jetzt** (Startansicht)
   - LIVE-Karte mit pulsierendem LIVE-Badge, Runde, Heim gegen Gast und „Spielstart geplant: HH:MM Uhr“
   - „Als Nächstes“ mit den 2 folgenden Spielen
   - Pausen-Übersicht
   - Letztes Ergebnis
   - Nach Turnierende: Siegerkarte mit dem Turniersieger und Verweis auf den Endstand
2. **Spielplan**: alle Spiele chronologisch mit Uhrzeit, Runde, Paarung und Ergebnis. Beendete Spiele sind abgeschwächt, das Live-Spiel ist hervorgehoben. Ein Team-Filter wird lokal gespeichert (localStorage, Fehler werden abgefangen).
3. **Tabellen**: Gruppen A und B mit Pl., Team, Sp., S, U, N, Tore, Diff., Pkt. Die Plätze 1–2 sind als Halbfinalplätze markiert.
4. **Finalrunde**: Bracket mit HF1, HF2, Spiel um Platz 3 und Finale, dazu die Platzierungsspiele. Wenn alles gespielt ist, kommt der Endstand mit Platz 1–10.
5. **Torschützen**: Rangliste mit hervorgehobenen Top 3.

**Visueller Stil:** sportlich-dunkel. Der Hintergrund ist fast schwarz, Akzent ist das Vereinsrot (ca. `#E30613`), die Schrift weiß. Das Wappen liegt unter `public/logo.png`. Ausgearbeitet wird das Design in der Umsetzung mit dem UI UX Pro Max Skill. Kontraste erfüllen WCAG AA, und die Touch-Ziele sind mindestens 44 px groß.

## 6. Architektur

**Stack:** Vite, TypeScript und Svelte 5. Getestet wird mit Vitest, CSV wird mit PapaParse geparst, die `.xlsx`-Vorlage erzeugt ExcelJS (nur als Dev-Abhängigkeit).

```
src/
  data/config.ts       Sheet-ID, Refresh-Intervall (30 s)
  data/sheets.ts       lädt 4 Blätter parallel (gviz-CSV) → Rohzeilen
  data/parse.ts        Rohzeilen → typisierte Daten + Liste von Warnungen
  domain/types.ts      Settings, Team, Match, Player, Snapshot …
  domain/schedule.ts   Uhrzeiten, Live-/Nächstes-Spiel
  domain/standings.ts  Gruppentabellen inkl. Tiebreaker
  domain/bracket.ts    Platzhalter-Auflösung, Endstand
  domain/rest.ts       Pausen-Übersicht
  domain/scorers.ts    Torschützenliste
  domain/snapshot.ts   setzt alles zu einem Snapshot zusammen
  ui/App.svelte        Tabs, Kopfbereich, Refresh-Schleife
  ui/tabs/*.svelte     Jetzt, Spielplan, Tabellen, Finalrunde, Torschützen
  ui/components/*      MatchCard, LiveBadge, StandingsTable … (wiederverwendbar für spätere TV-Ansicht)
tools/
  schedule-gen.ts      erzeugt die Spielreihenfolge 1–27 (auch von Tests genutzt)
  template.ts          schreibt die .xlsx-Vorlage
```

Die `domain/`-Module sind reine Funktionen ohne Netzwerk-, DOM- oder Svelte-Abhängigkeit.

**Datenfluss:** Beim Start, alle 30 s und bei `visibilitychange` auf sichtbar läuft `sheets.ts`, dann `parse.ts`, dann `snapshot.ts`, und der Snapshot landet in einem Svelte-State, aus dem die UI rendert. Zur aktuellen Uhrzeit hängt nur die Anzeige „aktualisiert vor X s“ ab. Die Live-Logik richtet sich nicht nach der Uhr, sondern nach den Ergebnissen.

## 7. Fehlerbehandlung

- **Netzwerkfehler:** Der letzte Snapshot bleibt sichtbar, ein Banner zeigt „Offline, Daten von HH:MM“, und der nächste Versuch kommt im normalen Intervall. Gibt es beim ersten Laden noch gar keine Daten, erscheint eine Fehlermeldung mit „Erneut versuchen“.
- **Ungültige Zellwerte** wie nicht-numerische Tore, ein unbekanntes Team, eine fehlende Pflichteinstellung oder ein Unentschieden im K.-o.-Spiel: Der betroffene Wert bzw. die Zeile wird ignoriert, und eine Warnung wird gesammelt. Warnungen erscheinen als dezenter, aufklappbarer Hinweis. Die Seite stürzt nicht ab.
- **Nicht auflösbare Platzhalter** werden als Platzhalter angezeigt, z. B. „A1“, „Sieger HF1“ oder „A1 (Los ausstehend)“.

## 8. Tests

- TDD mit Vitest für alle `domain/`-Module und `parse.ts`. Schwerpunkte:
  - Tiebreaker: Tordifferenz, direkter Vergleich zwischen 2 und zwischen 3 Teams, geschossene Tore, Los, „Los ausstehend“
  - Bracket: Auflösung erst nach Gruppenende, Halbfinal-Sieger und -Verlierer, Endstand 1–10, Unentschieden im K.-o.-Spiel
  - Uhrzeiten, Live-Spiel, Pausen-Übersicht inklusive Finalrunde und „wartet auf Finalrunde“
  - Torschützen mit geteilten Rängen
  - `schedule-gen`: jedes Paar genau einmal, A/B im Wechsel, kein Team mit zwei Gruppenspielen direkt hintereinander
- Ein Fixture-Test parst echte gviz-CSV-Beispieldateien.
- Abschluss: manueller Check im Browser bei 375 px Breite (Chrome DevTools/Playwright) gegen eine echte Test-Tabelle.

## 9. Deployment

Ein GitHub-Actions-Workflow führt bei jedem Push auf `main` Tests und Build aus und veröffentlicht `dist/` auf GitHub Pages. Der Vite-`base` wird auf `/Stammtisch-Turnier/` gesetzt. Die Repository-Einstellung „Pages → Source: GitHub Actions“ aktiviert der Repo-Besitzer.

## 10. Offene Punkte vor der Umsetzung

- Das Repo `github.com/kaelus707/Stammtisch-Turnier` wird vor dem ersten Deployment öffentlich gestellt (kein GitHub Pro).
- Die Sheet-ID wird nachgetragen, sobald der Veranstalter die Vorlage in Google Drive importiert hat. Bis dahin arbeiten Entwicklung und Tests mit lokalen CSV-Fixtures.
