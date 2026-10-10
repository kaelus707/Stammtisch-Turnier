# Stammtischturnier: Die Tabelle rechnet, die Webseite zeigt an

Stand: 10.10.2026 · Ergänzt und ersetzt Teile von `2026-10-10-stammtisch-turnier-design.md` (Abschnitte 3–5).

## 1. Ziel

Die Google-Tabelle ist die einzige Stelle, an der gerechnet wird: Gruppentabellen, Tiebreaks, K.-o.-Paarungen, Sieger, Turnierbaum und Endplatzierung. Der Veranstalter trägt nur Tore ein. Alles andere ergibt sich per Formel, so wie beim Bonsai Cup 2026.

Die Webseite rechnet nichts mehr. Sie liest die fertigen Werte und zeigt sie an.

Vom Bonsai Cup übernommen werden der Aufbau (Teamcodes, Spielplan-Spalten, Gruppenblätter, Turnierbaum, Endplatzierung) und die Formel-Technik mit Codes und INDEX/MATCH. Nicht übernommen wird die Tennis-Wertung. Es gelten die Fußballregeln aus Abschnitt 2 des Haupt-Designs.

**Nicht im Umfang:**

- Pausenzeilen im Zeitplan, die Spalte „Platz“ sowie die Blätter „Übersicht“ und „WEB“.
- Bedingte Formatierung, etwa einen grün markierten Sieger. Möglich ist sie später, sie ist aber nicht nötig.

## 2. Turniermodus (unverändert)

- 10 Teams in den Gruppen A und B zu je 5 Teams.
- Die Spiele 1–20 sind Gruppenspiele, abwechselnd A und B.
- Die Spiele 21–27 bilden die Finalrunde.
- Wertung: Sieg 3, Unentschieden 1, Niederlage 0.
- Reihenfolge in der Tabelle:
  1. Punkte
  2. Tordifferenz
  3. Mini-Tabelle der punkt- und tordifferenzgleichen Teams: erst Punkte, dann Tordifferenz aus den Spielen dieser Teams untereinander
  4. Geschossene Tore
  5. Los

  Bleiben Teams nach Stufe 4 gleich und fehlt ein Los oder ist es doppelt vergeben, gilt der Platz als „Los ausstehend“.
- Finalrunde:

| Nr. | Runde | Team A | Team B |
|---|---|---|---|
| 21 | Spiel um Platz 9 | 5. Gr. A | 5. Gr. B |
| 22 | Halbfinale 1 | 1. Gr. A | 2. Gr. B |
| 23 | Spiel um Platz 7 | 4. Gr. A | 4. Gr. B |
| 24 | Halbfinale 2 | 2. Gr. A | 1. Gr. B |
| 25 | Spiel um Platz 5 | 3. Gr. A | 3. Gr. B |
| 26 | Spiel um Platz 3 | Verlierer HF1 | Verlierer HF2 |
| 27 | Finale | Sieger HF1 | Sieger HF2 |

- K.-o.-Spiele gehen bei Gleichstand ins Neunmeterschießen. Eingetragen wird das Gesamtergebnis inklusive Neunmeter.

## 3. Tabelle (Generator `tools/template.ts` → `vorlage/stammtisch-turnier.xlsx`)

Allgemein gilt:

- Jede Tabelle beginnt in Zeile 1 mit ihren Spaltenüberschriften, damit der gviz-Export sauber funktioniert.
- Formeln werden ohne zwischengespeichertes Ergebnis geschrieben. Excel und Google Sheets rechnen beim Öffnen bzw. Import neu.
- Es werden nur Funktionen verwendet, die Excel, Google Sheets und HyperFormula gemeinsam kennen: `IF`, `IFERROR`, `AND`, `OR`, `INDEX`, `MATCH`, `SUMPRODUCT`, `COUNTIFS`, `TEXT`, `TIMEVALUE`, `VALUE` und `N`.
- Nur die Tor-Zellen, die Teamnamen und die Los-Werte sind Eingabefelder. Sie sind gelb hinterlegt.

### 3.1 `Einstellungen` (unverändert)

Spalten: Feld | Wert. Zeilen 2–6: Turniername, Datum, Startzeit, Spieldauer (Min.), Pause (Min.). Alle Werte stehen als Text in den Zellen.

### 3.2 `Teams`

| Code | Team | Gruppe | Los |
|---|---|---|---|
| A1 … A5, B1 … B5 (fest) | Name (Eingabe) | A/B (fest) | Ganzzahl, optional (Eingabe) |

Die Zeilen 2–11 sind fest vorgegeben. Code und Gruppe ändert man nicht. Alle anderen Blätter verweisen nur über den Code auf ein Team.

### 3.3 `Spielplan` (Zeilen 2–28 = Spiele 1–27)

| Spalte | Kopf | Inhalt |
|---|---|---|
| A | Nr. | 1–27 (fest) |
| B | Phase | Spiele 1–20 `Gruppenphase`, 21/23/25/26 `Platzierungsspiel`, 22/24 `Halbfinale`, 27 `Finale` (fest) |
| C | Zeit | `=TEXT(TIMEVALUE(Einstellungen!B4)+(A2-1)*(VALUE(Einstellungen!B5)+VALUE(Einstellungen!B6))/1440,"hh:mm")` |
| D | Runde | `Gruppe A` / `Gruppe B` bzw. der Name laut Tabelle in Abschnitt 2 |
| E | Code A | Gruppenspiel: fester Code. K.-o.: aufgelöster Code oder leer |
| F | Team A | Name per INDEX/MATCH über den Code. Ist der Code leer, steht dort der Platzhalter-Text, zum Beispiel `1. Gr. A`, `Sieger HF1` oder `2. Gr. A (Los ausstehend)` |
| G | Code B | wie E |
| H | Team B | wie F |
| I | Tore A | Eingabe |
| J | Tore B | Eingabe |
| K | Sieger | Name des Siegers, `Unentschieden` oder leer, solange das Spiel offen ist |
| L | Sieger-Code | Hilfsspalte (ausgeblendet) |
| M | Verlierer-Code | Hilfsspalte (ausgeblendet) |

- Gespielt ist ein Spiel, wenn I und J beide gefüllt sind.
- Gruppenspiele behalten die bestehende Reihenfolge (`GROUP_ORDER`, abwechselnd A und B).
- K.-o.-Codes:
  - Gruppenplatz k von Gruppe X: der Code aus der Endtabelle von Gruppe X, aber nur wenn die Gruppe komplett ist und Platz k nicht „Los ausstehend“ zeigt. Sonst bleibt die Zelle leer.
  - `Sieger HF1/HF2` bzw. `Verlierer HF1/HF2` = L bzw. M der Halbfinal-Zeile.

### 3.4 `Gruppe A` / `Gruppe B`

**Oben (A1:K6) steht die Anzeige-Tabelle, die auch die Webseite liest.** Sie ist schon sortiert:

| Platz | Code | Team | Sp | S | U | N | Tore | Gegentore | Diff | Pkt |
|---|---|---|---|---|---|---|---|---|---|---|

Zusätzlich gibt es die Spalte L mit der Überschrift `Hinweis`. Sie enthält `Los ausstehend` oder bleibt leer. Der Bereich der Webseite ist damit A1:L6.

**Ab Zeile 9 folgt die Rechenhilfe.** Ihre Zellen sind grau hinterlegt und nicht zum Bearbeiten gedacht. Sie hat eine Zeile pro Team in fester Code-Reihenfolge X1–X5:

- Code, Team, Sp, S, U, N, Tore, Gegentore, Diff und Pkt, berechnet per `SUMPRODUCT` über die **Spielplan-Zeilen 2–21** (nur Gruppenspiele).
- Die Kreuztabelle 5×5 mit Punkten und Tordifferenz von Team i gegen Team j. Ist das Spiel noch offen, steht dort 0.
- Mini-Tabelle: `H2H-Pkt(i) = Σ_j P(i,j)·[Pkt(j)=Pkt(i)]·[Diff(j)=Diff(i)]`. Für `H2H-Diff` gilt dasselbe.
- `Schlüssel = Pkt·10^11 + (Diff+500)·10^8 + H2H-Pkt·10^6 + (H2H-Diff+500)·10^3 + Tore`. Der Wert bleibt unter 15 Stellen und ist damit exakt.
- `Rang = 1 + Anzahl(Schlüssel_j > Schlüssel_i) + Anzahl(Schlüssel_j = Schlüssel_i und Los_j < Los_i; ein leeres Los zählt als schlechtester)`.
- `Los ausstehend(i)` gilt, wenn es ein j≠i mit gleichem Schlüssel gibt und bei i oder j das Los fehlt oder beide Lose gleich sind.
- `Anzeigeplatz` ist der Rang plus die Zahl der vorherigen Zeilen mit gleichem Rang. Damit ist er eindeutig und funktioniert auch bei „Los ausstehend“.
- `Gruppe komplett` ist erfüllt, wenn 10 Gruppenspiele dieser Gruppe gespielt sind.

Die Anzeige-Tabelle holt sich für Platz p die Zeile mit Anzeigeplatz p über `INDEX/MATCH`. `Platz` ist der Anzeigeplatz (1–5, eindeutig), so wie die Webseite bisher nummeriert. Gleichstehende Teams erkennt man am Hinweis „Los ausstehend“, der erst bei kompletter Gruppe erscheint.

Zwei Hilfsspalten außerhalb des Webseiten-Bereichs versorgen den Spielplan:

- M `KO-Code`: der Code, wenn die Gruppe komplett ist und kein Hinweis gesetzt ist.
- N `Platzhalter`: zum Beispiel `2. Gr. A` oder `2. Gr. A (Los ausstehend)`.

### 3.5 `Turnierbaum`

Das Blatt enthält reine Verweise auf `Spielplan`, mit Teamname und Tor-Spalte nebeneinander:

- Block „Halbfinale“: HF1 und HF2.
- Block „Finale“ und „Spiel um Platz 3“.
- Block „Platzierungsspiele“: Spiel um Platz 5, 7 und 9.

Die Webseite liest dieses Blatt nicht.

### 3.6 `Endplatzierung` (A1:D11, wird von der Webseite gelesen)

| Platz | Team | Gruppe | Herkunft |
|---|---|---|---|

Die Zeilen für die Plätze 1–10 sind fest vorgegeben:

- Platz 1/2 = Sieger/Verlierer des Finales
- Platz 3/4 = Spiel um Platz 3
- Platz 5/6 = Spiel um Platz 5
- Platz 7/8 = Spiel um Platz 7
- Platz 9/10 = Spiel um Platz 9

Team und Gruppe kommen per Code aus `Teams`. Solange ein Platz noch offen ist, bleibt die Zelle leer.

### 3.7 `Spieler` (unverändert)

Name | Team | Tore.

## 4. Webseite: nur Anzeige

### 4.1 Gelesene Blätter

`Einstellungen`, `Teams`, `Spielplan`, `Spieler`, `Gruppe A`, `Gruppe B` und `Endplatzierung`.

Die Gruppenblätter und `Endplatzierung` werden mit dem gviz-Parameter `range=` auf den Anzeige-Bereich begrenzt (A1:L6 bzw. A1:D11). Sonst würde die Rechenhilfe die Typ-Erkennung von gviz stören. Die Demo-CSVs in `public/demo/` enthalten genau diese Bereiche.

### 4.2 Einlesen (`src/data/parse.ts`)

- **Teams:** Pflichtspalten sind `Team` und `Gruppe`. Der `Code` wird nicht gebraucht und auch nicht gelesen. Das Los wird nicht mehr gebraucht.
- **Spielplan:** Pflichtspalten sind `Nr.`, `Runde`, `Team A`, `Team B`, `Tore A`, `Tore B` und `Sieger`.
  - `Team A` bzw. `Team B`: Entspricht der Wert einem Teamnamen, ist die Seite aufgelöst. Sonst ist es ein Platzhalter-Text, der so angezeigt wird, wie er ist.
  - `Sieger`: Ist es ein Teamname, ist das der Sieger, und der Verlierer ist das andere Team. `Unentschieden` in einem K.-o.-Spiel ergibt eine Warnung „Sieger unbestimmt“.
  - `Gruppe` ergibt sich aus `Runde` (`Gruppe A`/`B`). Bei allen anderen Runden ist sie null.
- **Gruppe A/B:** Daraus wird eine `GroupTable` mit den Zeilen in Blattreihenfolge. `rank` kommt aus `Platz` und `lotPending` aus `Hinweis`. `complete` ist erfüllt, wenn alle Teams Sp = 4 haben.
- **Endplatzierung:** `ranking[Platz-1]` ist das Team oder null.
- **Ungültige Werte** wie Tore, die keine Zahl sind, eine fehlende Spalte oder ein leeres Blatt: Die Zeile wird ignoriert, und eine Warnung kommt in die Warnungsliste. Die Seite stürzt nicht ab.

### 4.3 Domäne

- `standings.ts` und `bracket.ts` werden samt Tests gelöscht.
- `snapshot.ts` baut den Snapshot aus den eingelesenen Tabellen, Spielen (mit `homeSide`/`awaySide`/`winner`/`loser`) und dem Ranking.
- Der Typ `Snapshot` bleibt gleich. Die UI-Komponenten bleiben deshalb unverändert.
- `schedule.ts` (geplante Startzeit, aktuelles bzw. nächstes Spiel), `rest.ts` und `scorers.ts` bleiben. Sie ordnen nur an und rechnen keine Wertung.
- Der Parser liefert direkt `ResolvedMatch` (mit `homeSide`/`awaySide`/`winner`/`loser`/`undecided`). Die Typen in `types.ts` bleiben bis auf `Team.lot`, das entfällt.

## 5. Prüfung

- **Formeln:** `tools/calc.ts` lädt die erzeugte Arbeitsmappe in HyperFormula (Dev-Abhängigkeit, Lizenz `gpl-v3`) und liest berechnete Werte aus. Die Tests in `tools/template.test.ts` decken ab:
  1. Ein komplettes Turnier mit eindeutigen Tabellen ergibt die erwarteten Plätze, K.-o.-Paarungen, Sieger und die Endplatzierung 1–10.
  2. Drei Teams mit gleichen Punkten und gleicher Tordifferenz werden über die Mini-Tabelle richtig sortiert.
  3. Ein voller Gleichstand ohne Los ergibt „Los ausstehend“ in der Tabelle und den Platzhalter im K.-o.-Spiel. Mit eingetragenem Los wird der Platz aufgelöst.
  4. Ist eine Gruppe noch nicht komplett, zeigen die K.-o.-Zeilen Platzhalter.
  5. Die Zeit für Spiel 1 ist die Startzeit, für Spiel 2 Startzeit + Spieldauer + Pause.
- **Demo-Daten:** `tools/demo.ts` füllt die Vorlage mit Demo-Ergebnissen, rechnet sie mit HyperFormula aus und schreibt die CSVs nach `public/demo/`. So passen die Demo-Daten immer zu den Formeln.
- **Parser und Snapshot:** Die Vitest-Tests werden auf das neue Format umgestellt.
- **Browser:** Mit den Demo-Daten werden alle Tabs geprüft.
- **Google Sheets:** Ob Google die Formeln genauso rechnet, prüft der Veranstalter nach dem Upload anhand einer Checkliste in der README, mit dem Demo-Turnier als Referenz.

## 6. Folgen für den Betrieb

- Die neue Vorlage muss einmal nach Google Drive hochgeladen und als Google-Tabelle geöffnet werden. Danach kommt die Sheet-ID in `src/data/config.ts`.
- Ein Sheet mit Live-Daten gibt es noch nicht, es müssen also keine Daten übernommen werden.
- Wer Paarungen von Hand ändert, ändert die Code-Zellen im Spielplan. Die Webseite folgt automatisch.
