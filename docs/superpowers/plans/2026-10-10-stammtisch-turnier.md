# Stammtisch-Turnier Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eine statische, mobile Webseite, die eine öffentlich lesbare Google-Tabelle alle 30 s ausliest und daraus Live-Spiel, Spielplan, Gruppentabellen, Finalrunde, Pausen-Übersicht und Torschützenliste des Stammtischturniers anzeigt.

**Architecture:** Vite + Svelte 5 Single-Page-App ohne Backend. `src/data/` lädt die vier Blätter als gviz-CSV und parst sie zu typisierten Daten plus Warnungen. `src/domain/` sind reine Funktionen (Tabellen, Platzhalter, Uhrzeiten, Pausen, Torschützen), die zu einem `Snapshot` zusammengesetzt werden, aus dem die UI rendert. Ohne Sheet-ID lädt die App Demo-CSVs aus `public/demo/`.

**Tech Stack:** Node 24, Vite 8, Svelte 5 (Runes), TypeScript 6, Vitest 5, PapaParse, ExcelJS (nur dev), GitHub Actions + GitHub Pages.

**Spec:** `docs/superpowers/specs/2026-10-10-stammtisch-turnier-design.md`

## Global Constraints

- Alle sichtbaren Texte auf Deutsch. Die Pausen-Texte exakt wie in Spec Abschnitt 4: „spielt jetzt“, „nächstes Spiel“, „noch N Spiele Pause“ (bei 1: „noch 1 Spiel Pause“), „wartet auf Finalrunde“, „fertig“.
- Keine laufenden Kosten, kein Server, keine API-Schlüssel. Laufzeit-Abhängigkeiten nur `svelte` und `papaparse`; alles andere ist `devDependency`.
- `src/domain/**` sind reine Funktionen: kein `fetch`, kein DOM, keine Svelte-Imports, kein `node:`-Import (Test-Dateien ausgenommen).
- TypeScript **^6** (svelte-check unterstützt TS 7 nicht). `verbatimModuleSyntax` ist an: Typen immer mit `import type` bzw. `type`-Modifier importieren.
- Dateien unter `tools/` importieren mit `.ts`-Endung (`./schedule-gen.ts`), weil sie direkt mit `node` (Type-Stripping) laufen. Dateien unter `src/` importieren ohne Endung.
- Vite-`base` ist `/Stammtisch-Turnier/`. URLs auf Dateien in `public/` in Svelte-Code immer über `import.meta.env.BASE_URL` bilden. Der Dev-Server läuft unter `http://localhost:5173/Stammtisch-Turnier/`.
- Mobile-first ab 360 px Breite, kein horizontales Scrollen der Seite, Touch-Ziele ≥ 44 px, Kontraste WCAG AA. Vereinsrot `#E30613` nur als Fläche mit weißer Schrift; roter Text nutzt `#FF4D57`.
- Jeder Zugriff auf `localStorage` steht in `try/catch`.
- Zeilenenden LF (`.gitattributes`), auch unter Windows.
- Jede Commit-Nachricht endet mit der Zeile `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` (zweites `-m`).
- Alle Befehle funktionieren in PowerShell und Bash. Test: `npm test`; Typprüfung: `npm run check`; Build: `npm run build`.

## Review Focus

1. **Tippfehler im Blattnamen:** gviz liefert bei unbekanntem Blattnamen still das *erste* Blatt. Erwartet: Warnung „Spalten fehlen“, keine falschen Daten. → Test in Task 3 („falsches Blatt geliefert“).
2. **Hängende Anfrage im Handynetz:** Ein `fetch` ohne Timeout blockiert die Refresh-Schleife für immer. Erwartet: Abbruch nach 15 s, nächster Versuch im Intervall. → Test in Task 10 (`signal` wird übergeben).
3. **Halb eingetragenes Ergebnis** (nur „Tore Heim“ gefüllt): Erwartet: Spiel gilt als nicht beendet, keine Warnung, kein Absturz. → Test in Task 3 und Task 4.
4. **Doppelte Teamnamen oder Spielnummern:** Würden Svelte-`{#each … (key)}` zum Absturz bringen. Erwartet: Duplikat wird mit Warnung verworfen. → Tests in Task 3.
5. **Gemischte Typen in einer Spalte** (Blatt `Einstellungen`, Spalte `Wert`): gviz leert Zellen des Minderheitstyps. Erwartet: Die Vorlage formatiert die Spalte als Text, alle Einstellungen kommen an. → Test in Task 15.

---

## File Structure

```
.gitattributes / .gitignore / package.json / tsconfig.json / vite.config.ts / svelte.config.js / index.html / README.md
.github/workflows/deploy.yml   Tests + Build + GitHub Pages
public/logo.png                (existiert)
public/demo/*.csv              Demo-Daten im gviz-Format (auch Test-Fixtures)
src/main.ts                    mountet App
src/app.css                    Design-Tokens, Grundstile
src/data/config.ts             SHEET_ID, REFRESH_MS
src/data/parse.ts              CSV → TournamentData + Warnungen; SHEET_NAMES, RawSheets
src/data/sheets.ts             lädt 4 Blätter parallel
src/domain/types.ts            alle Typen + isFinished
src/domain/fixtures.ts         Test-Helfer (nur von Tests importiert)
src/domain/schedule.ts         Sortierung, Uhrzeiten, Live/Nächste/Letztes
src/domain/standings.ts        Gruppentabellen mit Tiebreakern
src/domain/bracket.ts          Platzhalter-Auflösung, Sieger, Endstand
src/domain/rest.ts             Pausen-Übersicht + restLabel
src/domain/scorers.ts          Torschützenliste
src/domain/snapshot.ts         setzt alles zusammen
src/ui/format.ts               ago(), clock()
src/ui/App.svelte              Kopf, Tabs, Refresh-Schleife, Fehlerzustände
src/ui/tabs/{Now,Schedule,Tables,Final,Scorers}.svelte
src/ui/components/{MatchCard,LiveBadge,RestList,StandingsTable,WarningBox}.svelte
tools/schedule-gen.ts          Spielreihenfolge 1–27
tools/template.ts              schreibt vorlage/stammtisch-turnier.xlsx
```

---

### Task 1: Projekt-Grundgerüst

**Files:**
- Create: `.gitattributes`, `.gitignore`, `package.json`, `tsconfig.json`, `vite.config.ts`, `svelte.config.js`, `index.html`, `src/main.ts`, `src/ui/App.svelte`

**Interfaces:**
- Produces: npm-Skripte `dev`, `build`, `preview`, `check`, `test`, `template`; `src/ui/App.svelte` (Platzhalter, wird in Task 11 ersetzt).

- [ ] **Step 1: Zeilenenden und Ignore-Regeln anlegen**

`.gitattributes`:
```
* text=auto eol=lf
*.png binary
*.xlsx binary
```

`.gitignore`:
```
node_modules/
dist/
```

Dann bestehende Dateien normalisieren:
```bash
git add --renormalize .
```

- [ ] **Step 2: `package.json` anlegen**

```json
{
  "name": "stammtisch-turnier",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "check": "svelte-check --tsconfig ./tsconfig.json",
    "test": "vitest run --passWithNoTests",
    "template": "node tools/template.ts"
  }
}
```

- [ ] **Step 3: Abhängigkeiten installieren**

```bash
npm install svelte papaparse
```
```bash
npm install -D vite @sveltejs/vite-plugin-svelte typescript@^6 svelte-check @tsconfig/svelte vitest @types/node @types/papaparse exceljs
```
Expected: Installation ohne `ERESOLVE`-Fehler. (Stand 2026-10-10: vite 8.3, @sveltejs/vite-plugin-svelte 7.3, svelte 5.57, vitest 5.0, typescript 6.0.3.)

- [ ] **Step 4: Konfigurationsdateien anlegen**

`tsconfig.json`:
```json
{
  "extends": "@tsconfig/svelte/tsconfig.json",
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "allowImportingTsExtensions": true,
    "skipLibCheck": true,
    "types": ["vite/client", "node"]
  },
  "include": ["src/**/*.ts", "src/**/*.svelte", "tools/**/*.ts", "vite.config.ts"]
}
```

`vite.config.ts`:
```ts
import { defineConfig } from 'vitest/config';
import { svelte } from '@sveltejs/vite-plugin-svelte';

export default defineConfig({
  base: '/Stammtisch-Turnier/',
  plugins: [svelte()],
  test: { environment: 'node' },
});
```

`svelte.config.js`:
```js
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

export default { preprocess: vitePreprocess() };
```

`index.html`:
```html
<!doctype html>
<html lang="de">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
    <meta name="theme-color" content="#0b0b0d" />
    <link rel="icon" type="image/png" href="/logo.png" />
    <title>Stammtischturnier SV Saaldorf</title>
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
```

`src/main.ts`:
```ts
import { mount } from 'svelte';
import App from './ui/App.svelte';

mount(App, { target: document.getElementById('app')! });
```

`src/ui/App.svelte`:
```svelte
<h1>Stammtischturnier</h1>
```

- [ ] **Step 5: Prüfen, dass alles läuft**

Run: `npm test`
Expected: Exit 0, „No test files found“.

Run: `npm run check`
Expected: `svelte-check found 0 errors`. Falls TS 6 eine Option aus `@tsconfig/svelte` als veraltet meldet, diese Option in `tsconfig.json` explizit auf einen gültigen Wert überschreiben.

Run: `npm run build`
Expected: `dist/index.html` existiert, die Asset-Pfade beginnen mit `/Stammtisch-Turnier/`.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "chore: Vite/Svelte/TS-Grundgerüst" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Domain-Typen und Spielreihenfolge

**Files:**
- Create: `src/domain/types.ts`, `tools/schedule-gen.ts`
- Test: `tools/schedule-gen.test.ts`

**Interfaces:**
- Produces (`src/domain/types.ts`): `Group`, `Settings`, `Team`, `Match`, `Player`, `TournamentData`, `StandingRow`, `GroupTable`, `Side`, `ResolvedMatch`, `ScheduledMatch`, `RestStatus`, `RestEntry`, `ScorerRow`, `Snapshot`, `isFinished(m)`.
- Produces (`tools/schedule-gen.ts`): `Slot`, `PlanRow`, `GROUP_ORDER`, `KNOCKOUT`, `planRows(): PlanRow[]`.

- [ ] **Step 1: Typen anlegen**

`src/domain/types.ts`:
```ts
export type Group = 'A' | 'B';

export interface Settings {
  name: string;
  date: string;
  /** Minuten seit Mitternacht; null, wenn fehlend oder ungültig */
  startMinutes: number | null;
  matchMinutes: number | null;
  breakMinutes: number;
}

export interface Team {
  name: string;
  group: Group;
  /** kleiner = besser; null = kein Los eingetragen */
  lot: number | null;
}

export interface Match {
  nr: number;
  round: string;
  /** 'A'/'B' bei Gruppenspielen, null bei Finalrundenspielen */
  group: Group | null;
  /** Teamname oder Platzhalter wie 'A1', 'Sieger HF1' */
  home: string;
  away: string;
  homeGoals: number | null;
  awayGoals: number | null;
}

export interface Player {
  name: string;
  team: string;
  goals: number;
}

export interface TournamentData {
  settings: Settings;
  teams: Team[];
  matches: Match[];
  players: Player[];
}

export interface StandingRow {
  rank: number;
  team: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  diff: number;
  points: number;
  /** nach allen Kriterien gleich und Los fehlt */
  lotPending: boolean;
}

export interface GroupTable {
  group: Group;
  rows: StandingRow[];
  /** alle Gruppenspiele haben ein Ergebnis */
  complete: boolean;
}

/** Eine Seite einer Paarung: team = aufgelöster Teamname oder null, label = Anzeige */
export interface Side {
  team: string | null;
  label: string;
}

export interface ResolvedMatch extends Match {
  homeSide: Side;
  awaySide: Side;
  winner: string | null;
  loser: string | null;
  /** K.-o.-Spiel beendet, aber unentschieden */
  undecided: boolean;
}

export interface ScheduledMatch extends ResolvedMatch {
  /** Position in der nach Nr. sortierten Liste, ab 0 */
  index: number;
  startMinutes: number | null;
  finished: boolean;
}

export type RestStatus = 'playing' | 'next' | 'resting' | 'waiting' | 'done';

export interface RestEntry {
  team: string;
  status: RestStatus;
  /** Anzahl Spiele Pause bis zum nächsten eigenen Spiel (nur bei 'resting' > 0) */
  gap: number;
  matchIndex: number | null;
  startMinutes: number | null;
  /** Endplatz, falls bekannt (nur bei 'done') */
  place: number | null;
}

export interface ScorerRow {
  rank: number;
  name: string;
  team: string;
  goals: number;
}

export interface Snapshot {
  settings: Settings;
  tables: GroupTable[];
  matches: ScheduledMatch[];
  liveIndex: number | null;
  nextIndices: number[];
  lastIndex: number | null;
  rest: RestEntry[];
  scorers: ScorerRow[];
  /** Index 0 = Platz 1; null = noch offen */
  ranking: (string | null)[];
  champion: string | null;
  warnings: string[];
}

export const isFinished = (m: Pick<Match, 'homeGoals' | 'awayGoals'>): boolean =>
  m.homeGoals !== null && m.awayGoals !== null;
```

- [ ] **Step 2: Failing Test für die Spielreihenfolge schreiben**

`tools/schedule-gen.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { GROUP_ORDER, planRows, type Slot } from './schedule-gen.ts';

describe('planRows', () => {
  const rows = planRows();

  it('hat 27 Spiele mit Nr. 1–27', () => {
    expect(rows.map((r) => r.nr)).toEqual(Array.from({ length: 27 }, (_, i) => i + 1));
  });

  it('wechselt in Spiel 1–20 zwischen Gruppe A und B', () => {
    rows.slice(0, 20).forEach((r, i) => expect(r.round).toBe(i % 2 === 0 ? 'Gruppe A' : 'Gruppe B'));
  });

  it('spielt in jeder Gruppe jedes Paar genau einmal', () => {
    const pairs = GROUP_ORDER.map(([a, b]) => [Math.min(a, b), Math.max(a, b)].join('-'));
    expect(new Set(pairs).size).toBe(10);
  });

  it('lässt kein Team zwei Gruppenspiele direkt hintereinander spielen', () => {
    for (let i = 1; i < GROUP_ORDER.length; i++) {
      const prev = GROUP_ORDER[i - 1];
      expect(GROUP_ORDER[i].some((t) => prev.includes(t))).toBe(false);
    }
  });

  it('verwendet in den Gruppenspielen Slots der richtigen Gruppe', () => {
    for (const r of rows.slice(0, 20)) {
      const g = r.round.endsWith('A') ? 'A' : 'B';
      expect((r.home as Slot).group).toBe(g);
      expect((r.away as Slot).group).toBe(g);
    }
  });

  it('hat die Finalrunde laut Spec', () => {
    expect(rows.slice(20).map((r) => [r.nr, r.round, r.home, r.away])).toEqual([
      [21, 'Spiel um Platz 9', 'A5', 'B5'],
      [22, 'Halbfinale 1', 'A1', 'B2'],
      [23, 'Spiel um Platz 7', 'A4', 'B4'],
      [24, 'Halbfinale 2', 'A2', 'B1'],
      [25, 'Spiel um Platz 5', 'A3', 'B3'],
      [26, 'Spiel um Platz 3', 'Verlierer HF1', 'Verlierer HF2'],
      [27, 'Finale', 'Sieger HF1', 'Sieger HF2'],
    ]);
  });
});
```

- [ ] **Step 3: Test laufen lassen**

Run: `npm test`
Expected: FAIL, `Cannot find module './schedule-gen.ts'` (o. ä.).

- [ ] **Step 4: Implementierung**

`tools/schedule-gen.ts`:
```ts
export type Slot = { group: 'A' | 'B'; i: number };

export interface PlanRow {
  nr: number;
  round: string;
  /** Slot = Team aus Blatt Teams (Index 0–4 in der Gruppe), string = Platzhalter */
  home: Slot | string;
  away: Slot | string;
}

/** Reihenfolge in einer 5er-Gruppe: jedes Paar genau einmal, aufeinanderfolgende Spiele ohne gemeinsames Team. */
export const GROUP_ORDER: [number, number][] = [
  [0, 1], [2, 3], [0, 4], [1, 2], [3, 4],
  [0, 2], [1, 3], [2, 4], [0, 3], [1, 4],
];

export const KNOCKOUT: [round: string, home: string, away: string][] = [
  ['Spiel um Platz 9', 'A5', 'B5'],
  ['Halbfinale 1', 'A1', 'B2'],
  ['Spiel um Platz 7', 'A4', 'B4'],
  ['Halbfinale 2', 'A2', 'B1'],
  ['Spiel um Platz 5', 'A3', 'B3'],
  ['Spiel um Platz 3', 'Verlierer HF1', 'Verlierer HF2'],
  ['Finale', 'Sieger HF1', 'Sieger HF2'],
];

export function planRows(): PlanRow[] {
  const rows: PlanRow[] = [];
  for (const [h, a] of GROUP_ORDER) {
    for (const group of ['A', 'B'] as const) {
      rows.push({ nr: rows.length + 1, round: `Gruppe ${group}`, home: { group, i: h }, away: { group, i: a } });
    }
  }
  for (const [round, home, away] of KNOCKOUT) rows.push({ nr: rows.length + 1, round, home, away });
  return rows;
}
```

- [ ] **Step 5: Tests und Typprüfung**

Run: `npm test`
Expected: PASS (6 Tests).

Run: `npm run check`
Expected: 0 errors.

- [ ] **Step 6: Commit**

```bash
git add src/domain/types.ts tools/schedule-gen.ts tools/schedule-gen.test.ts
git commit -m "feat: Domain-Typen und Spielreihenfolge" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: CSV-Parser und Demo-Daten

**Files:**
- Create: `src/data/parse.ts`, `public/demo/Einstellungen.csv`, `public/demo/Teams.csv`, `public/demo/Spielplan.csv`, `public/demo/Spieler.csv`
- Test: `src/data/parse.test.ts`

**Interfaces:**
- Consumes: Typen aus `src/domain/types.ts`.
- Produces: `SHEET_NAMES`, `type SheetName`, `type RawSheets = Record<SheetName, string>`, `isPlaceholder(s: string): boolean`, `parseTournament(raw: RawSheets): { data: TournamentData; warnings: string[] }`.

- [ ] **Step 1: Demo-Daten anlegen** (gviz-Format: Kopfzeile, alle Felder in Anführungszeichen)

`public/demo/Einstellungen.csv`:
```
"Feld","Wert"
"Turniername","Stammtischturnier 2026 (Demo)"
"Datum","14.11.2026"
"Startzeit","14:00"
"Spieldauer (Min.)","10"
"Pause (Min.)","2"
```

`public/demo/Teams.csv`:
```
"Team","Gruppe","Los"
"FC Bierbauch","A",""
"Stammtisch Mitte","A",""
"Die Wadlbeißer","A",""
"Saaldorfer Buam","A",""
"Alte Herren","A",""
"Feuerwehr","B",""
"Schützenverein","B",""
"Kegelclub","B",""
"Trachtler","B",""
"Burschenverein","B",""
```

`public/demo/Spielplan.csv`:
```
"Nr.","Runde","Heim","Gast","Tore Heim","Tore Gast"
"1","Gruppe A","FC Bierbauch","Stammtisch Mitte","2","1"
"2","Gruppe B","Feuerwehr","Schützenverein","0","0"
"3","Gruppe A","Die Wadlbeißer","Saaldorfer Buam","3","2"
"4","Gruppe B","Kegelclub","Trachtler","1","2"
"5","Gruppe A","FC Bierbauch","Alte Herren","1","1"
"6","Gruppe B","Feuerwehr","Burschenverein","2","0"
"7","Gruppe A","Stammtisch Mitte","Die Wadlbeißer","0","2"
"8","Gruppe B","Schützenverein","Kegelclub","3","1"
"9","Gruppe A","Saaldorfer Buam","Alte Herren","2","2"
"10","Gruppe B","Trachtler","Burschenverein","1","0"
"11","Gruppe A","FC Bierbauch","Die Wadlbeißer","1","0"
"12","Gruppe B","Feuerwehr","Kegelclub","",""
"13","Gruppe A","Stammtisch Mitte","Saaldorfer Buam","",""
"14","Gruppe B","Schützenverein","Trachtler","",""
"15","Gruppe A","Die Wadlbeißer","Alte Herren","",""
"16","Gruppe B","Kegelclub","Burschenverein","",""
"17","Gruppe A","FC Bierbauch","Saaldorfer Buam","",""
"18","Gruppe B","Feuerwehr","Trachtler","",""
"19","Gruppe A","Stammtisch Mitte","Alte Herren","",""
"20","Gruppe B","Schützenverein","Burschenverein","",""
"21","Spiel um Platz 9","A5","B5","",""
"22","Halbfinale 1","A1","B2","",""
"23","Spiel um Platz 7","A4","B4","",""
"24","Halbfinale 2","A2","B1","",""
"25","Spiel um Platz 5","A3","B3","",""
"26","Spiel um Platz 3","Verlierer HF1","Verlierer HF2","",""
"27","Finale","Sieger HF1","Sieger HF2","",""
```

`public/demo/Spieler.csv`:
```
"Name","Team","Tore"
"Max Huber","FC Bierbauch","3"
"Sepp Maier","Die Wadlbeißer","3"
"Toni Gruber","Schützenverein","3"
"Flo Wimmer","Saaldorfer Buam","2"
"Hans Berger","Feuerwehr","2"
"Michi Schmid","Alte Herren","2"
"Basti Hofer","Trachtler","2"
"Lukas Brandl","Kegelclub","1"
"Andi Reiter","Stammtisch Mitte","1"
"Quirin Stadler","Burschenverein",""
```

- [ ] **Step 2: Failing Tests schreiben**

`src/data/parse.test.ts`:
```ts
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseTournament, SHEET_NAMES, type RawSheets } from './parse';

const csv = (rows: (string | number)[][]) =>
  rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');

const base = (): RawSheets => ({
  Einstellungen: csv([
    ['Feld', 'Wert'],
    ['Turniername', 'Test-Turnier'],
    ['Datum', '14.11.2026'],
    ['Startzeit', '14:00'],
    ['Spieldauer (Min.)', '10'],
    ['Pause (Min.)', '2'],
  ]),
  Teams: csv([
    ['Team', 'Gruppe', 'Los'],
    ['Rot', 'A', ''],
    ['Blau', 'A', '1'],
    ['Grün', 'B', ''],
    ['Gelb', 'B', ''],
  ]),
  Spielplan: csv([
    ['Nr.', 'Runde', 'Heim', 'Gast', 'Tore Heim', 'Tore Gast'],
    ['1', 'Gruppe A', 'Rot', 'Blau', '2', '1'],
    ['2', 'Gruppe B', 'Grün', 'Gelb', '', ''],
    ['3', 'Halbfinale 1', 'A1', 'B2', '', ''],
  ]),
  Spieler: csv([
    ['Name', 'Team', 'Tore'],
    ['Max', 'Rot', '2'],
    ['Moritz', 'Blau', ''],
  ]),
});

describe('parseTournament', () => {
  it('liest gültige Daten ohne Warnungen', () => {
    const { data, warnings } = parseTournament(base());
    expect(warnings).toEqual([]);
    expect(data.settings).toEqual({
      name: 'Test-Turnier', date: '14.11.2026', startMinutes: 840, matchMinutes: 10, breakMinutes: 2,
    });
    expect(data.teams).toEqual([
      { name: 'Rot', group: 'A', lot: null },
      { name: 'Blau', group: 'A', lot: 1 },
      { name: 'Grün', group: 'B', lot: null },
      { name: 'Gelb', group: 'B', lot: null },
    ]);
    expect(data.matches[0]).toEqual({
      nr: 1, round: 'Gruppe A', group: 'A', home: 'Rot', away: 'Blau', homeGoals: 2, awayGoals: 1,
    });
    expect(data.matches[2]).toMatchObject({ nr: 3, group: null, home: 'A1', away: 'B2', homeGoals: null });
    expect(data.players).toEqual([
      { name: 'Max', team: 'Rot', goals: 2 },
      { name: 'Moritz', team: 'Blau', goals: 0 },
    ]);
  });

  it('akzeptiert Startzeit mit Sekunden', () => {
    const raw = { ...base(), Einstellungen: base().Einstellungen.replace('"14:00"', '"14:30:00"') };
    expect(parseTournament(raw).data.settings.startMinutes).toBe(870);
  });

  it('warnt bei fehlender Startzeit und setzt null', () => {
    const raw = { ...base(), Einstellungen: base().Einstellungen.replace('"14:00"', '""') };
    const { data, warnings } = parseTournament(raw);
    expect(data.settings.startMinutes).toBeNull();
    expect(warnings).toContain('Einstellung „Startzeit“ fehlt oder ist ungültig (Format HH:MM).');
  });

  it('nimmt 2 Minuten Pause, wenn das Feld leer ist', () => {
    const raw = { ...base(), Einstellungen: base().Einstellungen.replace('"Pause (Min.)","2"', '"Pause (Min.)",""') };
    const { data, warnings } = parseTournament(raw);
    expect(data.settings.breakMinutes).toBe(2);
    expect(warnings).toEqual([]);
  });

  it('verwirft Teams mit ungültiger Gruppe oder doppeltem Namen', () => {
    const raw = { ...base(), Teams: csv([['Team', 'Gruppe', 'Los'], ['Rot', 'A', ''], ['Rot', 'B', ''], ['Lila', 'C', '']]) };
    const { data, warnings } = parseTournament(raw);
    expect(data.teams.map((t) => t.name)).toEqual(['Rot']);
    expect(warnings).toContain('Team „Rot“ ist doppelt eingetragen.');
    expect(warnings).toContain('Team „Lila“: Gruppe „C“ ist ungültig (A oder B).');
  });

  it('verwirft Spiele mit unbekanntem Team und doppelter Nr.', () => {
    const raw = {
      ...base(),
      Spielplan: csv([
        ['Nr.', 'Runde', 'Heim', 'Gast', 'Tore Heim', 'Tore Gast'],
        ['1', 'Gruppe A', 'Rot', 'Pink', '', ''],
        ['2', 'Gruppe A', 'Rot', 'Blau', '', ''],
        ['2', 'Gruppe B', 'Grün', 'Gelb', '', ''],
      ]),
    };
    const { data, warnings } = parseTournament(raw);
    expect(data.matches.map((m) => m.nr)).toEqual([2]);
    expect(warnings).toContain('Spiel 1: Team „Pink“ ist unbekannt in Gruppe A, Zeile ignoriert.');
    expect(warnings).toContain('Spiel 2: Nr. doppelt, Zeile ignoriert.');
  });

  it('ignoriert ungültige Tore mit Warnung', () => {
    const raw = { ...base(), Spielplan: base().Spielplan.replace('"2","1"', '"x","1"') };
    const { data, warnings } = parseTournament(raw);
    expect(data.matches[0].homeGoals).toBeNull();
    expect(warnings).toContain('Spiel 1: Tore „x“ ungültig, ignoriert.');
  });

  it('wertet ein halb eingetragenes Ergebnis ohne Warnung als offen', () => {
    const raw = { ...base(), Spielplan: base().Spielplan.replace('"2","1"', '"2",""') };
    const { data, warnings } = parseTournament(raw);
    expect(data.matches[0]).toMatchObject({ homeGoals: 2, awayGoals: null });
    expect(warnings).toEqual([]);
  });

  it('warnt, wenn statt eines Blatts ein anderes geliefert wird', () => {
    // gviz liefert bei unbekanntem Blattnamen still das erste Blatt
    const raw = { ...base(), Teams: base().Einstellungen };
    const { data, warnings } = parseTournament(raw);
    expect(data.teams).toEqual([]);
    expect(warnings).toContain('Blatt „Teams“: Spalten fehlen: „Team“, „Gruppe“.');
  });

  it('warnt bei leerem Blatt', () => {
    const { warnings } = parseTournament({ ...base(), Spieler: '' });
    expect(warnings).toContain('Blatt „Spieler“ ist leer.');
  });

  it('parst die Demo-Dateien ohne Warnungen', () => {
    const raw = Object.fromEntries(
      SHEET_NAMES.map((s) => [s, readFileSync(new URL(`../../public/demo/${s}.csv`, import.meta.url), 'utf8')]),
    ) as RawSheets;
    const { data, warnings } = parseTournament(raw);
    expect(warnings).toEqual([]);
    expect(data.teams).toHaveLength(10);
    expect(data.matches).toHaveLength(27);
    expect(data.matches.filter((m) => m.homeGoals !== null && m.awayGoals !== null)).toHaveLength(11);
    expect(data.players).toHaveLength(10);
  });
});
```

- [ ] **Step 3: Tests laufen lassen**

Run: `npm test -- src/data/parse.test.ts`
Expected: FAIL, Modul `./parse` fehlt.

- [ ] **Step 4: Implementierung**

`src/data/parse.ts`:
```ts
import Papa from 'papaparse';
import type { Group, Match, Player, Settings, Team, TournamentData } from '../domain/types';

export const SHEET_NAMES = ['Einstellungen', 'Teams', 'Spielplan', 'Spieler'] as const;
export type SheetName = (typeof SHEET_NAMES)[number];
export type RawSheets = Record<SheetName, string>;

type Row = Record<string, string>;

const PLACEHOLDER = /^([AB][1-5]|(Sieger|Verlierer) HF[12])$/;
export const isPlaceholder = (s: string): boolean => PLACEHOLDER.test(s);

// gviz exportiert Ganzzahlen gelegentlich als "3.0"
const int = (s: string): number | null => (/^\d+(\.0+)?$/.test(s) ? parseInt(s, 10) : null);

function parseTime(s: string): number | null {
  const m = /^(\d{1,2}):(\d{2})(:\d{2})?$/.exec(s);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  return h < 24 && min < 60 ? h * 60 + min : null;
}

function table(csv: string, sheet: SheetName, required: string[], w: string[]): Row[] {
  const { data } = Papa.parse<string[]>(csv.trim(), { skipEmptyLines: 'greedy' });
  if (data.length === 0) {
    w.push(`Blatt „${sheet}“ ist leer.`);
    return [];
  }
  const header = data[0].map((h) => h.replace(/^﻿/, '').trim());
  const missing = required.filter((r) => !header.includes(r));
  if (missing.length) {
    w.push(`Blatt „${sheet}“: Spalten fehlen: ${missing.map((m) => `„${m}“`).join(', ')}.`);
    return [];
  }
  return data.slice(1).map((cells) => Object.fromEntries(header.map((h, i) => [h, (cells[i] ?? '').trim()])));
}

function parseSettings(rows: Row[], w: string[]): Settings {
  const get = (k: string) => rows.find((r) => r['Feld'] === k)?.['Wert'] ?? '';
  const name = get('Turniername');
  if (!name) w.push('Einstellung „Turniername“ fehlt.');
  const date = get('Datum');
  if (!date) w.push('Einstellung „Datum“ fehlt.');
  const startMinutes = parseTime(get('Startzeit'));
  if (startMinutes === null) w.push('Einstellung „Startzeit“ fehlt oder ist ungültig (Format HH:MM).');
  const matchMinutes = int(get('Spieldauer (Min.)'));
  if (matchMinutes === null) w.push('Einstellung „Spieldauer (Min.)“ fehlt oder ist ungültig.');
  const rawBreak = get('Pause (Min.)');
  const breakMinutes = rawBreak === '' ? 2 : int(rawBreak);
  if (breakMinutes === null) w.push('Einstellung „Pause (Min.)“ ist ungültig, verwende 2.');
  return { name: name || 'Stammtischturnier', date, startMinutes, matchMinutes, breakMinutes: breakMinutes ?? 2 };
}

function parseTeams(rows: Row[], w: string[]): Team[] {
  const teams: Team[] = [];
  for (const r of rows) {
    const name = r['Team'];
    if (!name) continue;
    const group = r['Gruppe'].toUpperCase();
    if (group !== 'A' && group !== 'B') {
      w.push(`Team „${name}“: Gruppe „${r['Gruppe']}“ ist ungültig (A oder B).`);
      continue;
    }
    if (teams.some((t) => t.name === name)) {
      w.push(`Team „${name}“ ist doppelt eingetragen.`);
      continue;
    }
    const rawLot = r['Los'] ?? '';
    const lot = rawLot === '' ? null : int(rawLot);
    if (rawLot !== '' && lot === null) w.push(`Team „${name}“: Los „${rawLot}“ ist keine Ganzzahl.`);
    teams.push({ name, group, lot });
  }
  return teams;
}

function parseMatches(rows: Row[], teams: Team[], w: string[]): Match[] {
  const matches: Match[] = [];
  for (const r of rows) {
    const nr = int(r['Nr.']);
    if (nr === null) {
      if (Object.values(r).some(Boolean)) w.push(`Spielplan: Zeile ohne gültige Nr. ignoriert.`);
      continue;
    }
    if (matches.some((m) => m.nr === nr)) {
      w.push(`Spiel ${nr}: Nr. doppelt, Zeile ignoriert.`);
      continue;
    }
    const g = /^Gruppe ([AB])$/i.exec(r['Runde']);
    const group = g ? (g[1].toUpperCase() as Group) : null;
    const known = (s: string) =>
      group ? teams.some((t) => t.name === s && t.group === group) : isPlaceholder(s) || teams.some((t) => t.name === s);
    const bad = [r['Heim'], r['Gast']].find((s) => !known(s));
    if (bad !== undefined) {
      w.push(`Spiel ${nr}: Team „${bad}“ ist unbekannt${group ? ` in Gruppe ${group}` : ''}, Zeile ignoriert.`);
      continue;
    }
    const goals = (s: string): number | null => {
      if (s === '') return null;
      const n = int(s);
      if (n === null) w.push(`Spiel ${nr}: Tore „${s}“ ungültig, ignoriert.`);
      return n;
    };
    matches.push({
      nr, round: r['Runde'], group, home: r['Heim'], away: r['Gast'],
      homeGoals: goals(r['Tore Heim']), awayGoals: goals(r['Tore Gast']),
    });
  }
  return matches;
}

function parsePlayers(rows: Row[], teams: Team[], w: string[]): Player[] {
  const players: Player[] = [];
  for (const r of rows) {
    const name = r['Name'];
    if (!name) continue;
    const team = r['Team'];
    if (team && !teams.some((t) => t.name === team)) w.push(`Spieler „${name}“: Team „${team}“ ist unbekannt.`);
    const raw = r['Tore'];
    const goals = raw === '' ? 0 : int(raw);
    if (goals === null) w.push(`Spieler „${name}“: Tore „${raw}“ ungültig, zähle 0.`);
    players.push({ name, team, goals: goals ?? 0 });
  }
  return players;
}

export function parseTournament(raw: RawSheets): { data: TournamentData; warnings: string[] } {
  const w: string[] = [];
  const settings = parseSettings(table(raw.Einstellungen, 'Einstellungen', ['Feld', 'Wert'], w), w);
  const teams = parseTeams(table(raw.Teams, 'Teams', ['Team', 'Gruppe'], w), w);
  const matches = parseMatches(
    table(raw.Spielplan, 'Spielplan', ['Nr.', 'Runde', 'Heim', 'Gast', 'Tore Heim', 'Tore Gast'], w), teams, w,
  );
  const players = parsePlayers(table(raw.Spieler, 'Spieler', ['Name', 'Team', 'Tore'], w), teams, w);
  return { data: { settings, teams, matches, players }, warnings: w };
}
```

- [ ] **Step 5: Tests laufen lassen**

Run: `npm test -- src/data/parse.test.ts`
Expected: PASS (11 Tests).

- [ ] **Step 6: Commit**

```bash
git add src/data/parse.ts src/data/parse.test.ts public/demo
git commit -m "feat: CSV-Parser mit Warnungen und Demo-Daten" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Uhrzeiten, Live-, Nächstes und Letztes Spiel

**Files:**
- Create: `src/domain/schedule.ts`, `src/domain/fixtures.ts`
- Test: `src/domain/schedule.test.ts`

**Interfaces:**
- Consumes: `Match`, `Settings`, `isFinished` aus `types.ts`.
- Produces (`schedule.ts`): `sortByNr<T extends Match>(ms: T[]): T[]`, `plannedStart(index: number, s: Settings): number | null`, `formatTime(min: number | null): string`, `findLive(sorted: Match[]): number | null`, `findNext(sorted: Match[], live: number | null, count?: number): number[]`, `findLast(sorted: Match[]): number | null`.
- Produces (`fixtures.ts`, nur für Tests): `settings(over?)`, `team(name, group, lot?)`, `m(nr, home, away, score?, group?)`, `ko(nr, round, home, away, score?)`.

- [ ] **Step 1: Test-Helfer anlegen**

`src/domain/fixtures.ts`:
```ts
// Nur für Tests.
import type { Group, Match, Settings, Team } from './types';

export const settings = (over: Partial<Settings> = {}): Settings => ({
  name: 'Test', date: '14.11.2026', startMinutes: 14 * 60, matchMinutes: 10, breakMinutes: 2, ...over,
});

export const team = (name: string, group: Group, lot: number | null = null): Team => ({ name, group, lot });

/** Gruppenspiel (oder beliebiges Spiel) mit optionalem Ergebnis */
export const m = (nr: number, home: string, away: string, score?: [number, number], group: Group | null = 'A'): Match => ({
  nr, round: group ? `Gruppe ${group}` : 'Test', group, home, away,
  homeGoals: score ? score[0] : null, awayGoals: score ? score[1] : null,
});

/** Finalrundenspiel */
export const ko = (nr: number, round: string, home: string, away: string, score?: [number, number]): Match => ({
  ...m(nr, home, away, score, null), round,
});
```

- [ ] **Step 2: Failing Tests schreiben**

`src/domain/schedule.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { m, settings } from './fixtures';
import { findLast, findLive, findNext, formatTime, plannedStart, sortByNr } from './schedule';

describe('schedule', () => {
  it('sortiert nach Nr.', () => {
    expect(sortByNr([m(3, 'a', 'b'), m(1, 'c', 'd'), m(2, 'e', 'f')]).map((x) => x.nr)).toEqual([1, 2, 3]);
  });

  it('berechnet die geplante Uhrzeit aus Start, Spieldauer und Pause', () => {
    expect(plannedStart(0, settings())).toBe(840);
    expect(formatTime(plannedStart(2, settings()))).toBe('14:24');
  });

  it('liefert null, wenn Startzeit oder Spieldauer fehlt', () => {
    expect(plannedStart(1, settings({ startMinutes: null }))).toBeNull();
    expect(plannedStart(1, settings({ matchMinutes: null }))).toBeNull();
    expect(formatTime(null)).toBe('–');
  });

  it('formatiert über Mitternacht hinaus', () => {
    expect(formatTime(24 * 60 + 10)).toBe('00:10');
  });

  it('nimmt das erste Spiel ohne Ergebnis als Live-Spiel, auch wenn später schon Ergebnisse stehen', () => {
    const ms = [m(1, 'a', 'b', [1, 0]), m(2, 'c', 'd'), m(3, 'e', 'f', [2, 2]), m(4, 'g', 'h'), m(5, 'i', 'j')];
    expect(findLive(ms)).toBe(1);
    expect(findNext(ms, 1)).toEqual([3, 4]);
    expect(findLast(ms)).toBe(2);
  });

  it('wertet halb eingetragene Ergebnisse als offen', () => {
    const half = { ...m(1, 'a', 'b'), homeGoals: 3 };
    expect(findLive([half])).toBe(0);
  });

  it('meldet Turnierende, wenn alle Spiele ein Ergebnis haben', () => {
    const ms = [m(1, 'a', 'b', [1, 0])];
    expect(findLive(ms)).toBeNull();
    expect(findNext(ms, null)).toEqual([]);
    expect(findLast([m(1, 'a', 'b')])).toBeNull();
  });
});
```

- [ ] **Step 3: Tests laufen lassen**

Run: `npm test -- src/domain/schedule.test.ts`
Expected: FAIL, Modul `./schedule` fehlt.

- [ ] **Step 4: Implementierung**

`src/domain/schedule.ts`:
```ts
import type { Match, Settings } from './types';
import { isFinished } from './types';

export const sortByNr = <T extends Match>(ms: T[]): T[] => [...ms].sort((a, b) => a.nr - b.nr);

export function plannedStart(index: number, s: Settings): number | null {
  if (s.startMinutes === null || s.matchMinutes === null) return null;
  return s.startMinutes + index * (s.matchMinutes + s.breakMinutes);
}

export function formatTime(min: number | null): string {
  if (min === null) return '–';
  const t = ((min % 1440) + 1440) % 1440;
  return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
}

export function findLive(sorted: Match[]): number | null {
  const i = sorted.findIndex((x) => !isFinished(x));
  return i === -1 ? null : i;
}

export function findNext(sorted: Match[], live: number | null, count = 2): number[] {
  if (live === null) return [];
  const out: number[] = [];
  for (let i = live + 1; i < sorted.length && out.length < count; i++) if (!isFinished(sorted[i])) out.push(i);
  return out;
}

export function findLast(sorted: Match[]): number | null {
  for (let i = sorted.length - 1; i >= 0; i--) if (isFinished(sorted[i])) return i;
  return null;
}
```

- [ ] **Step 5: Tests laufen lassen**

Run: `npm test -- src/domain/schedule.test.ts`
Expected: PASS (7 Tests).

- [ ] **Step 6: Commit**

```bash
git add src/domain/schedule.ts src/domain/schedule.test.ts src/domain/fixtures.ts
git commit -m "feat: Uhrzeiten und Live-/Nächstes-Spiel" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Gruppentabellen mit Tiebreakern

**Files:**
- Create: `src/domain/standings.ts`
- Test: `src/domain/standings.test.ts`

**Interfaces:**
- Consumes: `Team`, `Match`, `Group`, `GroupTable`, `StandingRow`, `isFinished`; Test-Helfer `m`, `team` aus `fixtures.ts`.
- Produces: `computeStandings(teams: Team[], matches: Match[], group: Group): GroupTable`.

Regeln (Spec Abschnitt 2): Punkte → Tordifferenz → direkter Vergleich (Mini-Tabelle nur der punkt- und tordifferenzgleichen Teams: Punkte, dann Tordifferenz) → mehr geschossene Tore gesamt → Los (kleiner = besser). Sind Teams nach Stufe 4 gleich und fehlt bei mindestens einem das Los (oder sind die Lose gleich), bekommen beide `lotPending: true`.

- [ ] **Step 1: Failing Tests schreiben**

`src/domain/standings.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { m, team } from './fixtures';
import { computeStandings } from './standings';

const five = (names: string[], lots: (number | null)[] = []) => names.map((n, i) => team(n, 'A', lots[i] ?? null));
const order = (t: ReturnType<typeof computeStandings>) => t.rows.map((r) => r.team);

describe('computeStandings', () => {
  it('zählt Spiele, Tore und Punkte und sortiert nach Punkten und Tordifferenz', () => {
    const t = computeStandings(five(['P', 'Q', 'R', 'S', 'T']), [m(1, 'P', 'Q', [3, 0]), m(2, 'R', 'S', [1, 0]), m(3, 'T', 'P', [1, 1])], 'A');
    expect(order(t).slice(0, 2)).toEqual(['P', 'R']);
    expect(t.rows[0]).toMatchObject({ rank: 1, played: 2, won: 1, drawn: 1, lost: 0, goalsFor: 4, goalsAgainst: 1, diff: 3, points: 4 });
    expect(t.complete).toBe(true);
  });

  it('ignoriert Spiele ohne Ergebnis und Spiele der anderen Gruppe', () => {
    const t = computeStandings(five(['P', 'Q', 'R', 'S', 'T']), [m(1, 'P', 'Q'), m(2, 'P', 'Q', [5, 0], 'B')], 'A');
    expect(t.rows.every((r) => r.played === 0)).toBe(true);
    expect(t.complete).toBe(false);
  });

  it('entscheidet zwischen 2 Teams den direkten Vergleich vor den geschossenen Toren', () => {
    const t = computeStandings(five(['P', 'Q', 'R', 'S', 'T']), [
      m(1, 'P', 'Q', [0, 1]),
      m(2, 'P', 'R', [3, 0]),
      m(3, 'P', 'S', [3, 1]),
      m(4, 'Q', 'T', [4, 0]),
      m(5, 'Q', 'S', [0, 1]),
    ], 'A');
    // P (6:2) und Q (5:1): je 6 Pkt., Diff +4; P hat mehr Tore, Q gewann aber den direkten Vergleich
    expect(order(t)).toEqual(['Q', 'P', 'S', 'R', 'T']);
  });

  it('nutzt bei 3 Teams die Mini-Tabelle und danach die geschossenen Tore', () => {
    const t = computeStandings(five(['P', 'Q', 'R', 'S', 'T']), [
      m(1, 'P', 'Q', [1, 0]),
      m(2, 'Q', 'R', [3, 0]),
      m(3, 'R', 'P', [2, 0]),
      m(4, 'P', 'S', [2, 0]),
      m(5, 'Q', 'S', [1, 0]),
      m(6, 'T', 'Q', [2, 0]),
      m(7, 'R', 'T', [2, 0]),
    ], 'A');
    // P, Q, R: je 6 Pkt., Diff +1. Mini-Tabelle: Q +2, P −1, R −1 → P/R per Tore gesamt (R 4, P 3)
    expect(order(t)).toEqual(['Q', 'R', 'P', 'T', 'S']);
    expect(t.rows.every((r) => !r.lotPending || r.points === 0)).toBe(true);
  });

  it('entscheidet bei völligem Gleichstand das Los (kleiner = besser)', () => {
    const t = computeStandings(five(['X', 'Y', 'Z', 'V', 'W'], [2, 1]), [m(1, 'X', 'Y', [1, 1])], 'A');
    expect(order(t).slice(0, 2)).toEqual(['Y', 'X']);
    expect(t.rows.slice(0, 2).map((r) => r.lotPending)).toEqual([false, false]);
  });

  it('markiert „Los ausstehend“, wenn bei Gleichstand ein Los fehlt', () => {
    const t = computeStandings(five(['X', 'Y', 'Z', 'V', 'W'], [1, null]), [m(1, 'X', 'Y', [1, 1])], 'A');
    expect(t.rows.slice(0, 2).map((r) => [r.team, r.lotPending])).toEqual([['X', true], ['Y', true]]);
  });
});
```

- [ ] **Step 2: Tests laufen lassen**

Run: `npm test -- src/domain/standings.test.ts`
Expected: FAIL, Modul `./standings` fehlt.

- [ ] **Step 3: Implementierung**

`src/domain/standings.ts`:
```ts
import type { Group, GroupTable, Match, StandingRow, Team } from './types';
import { isFinished } from './types';

type Stats = Omit<StandingRow, 'rank' | 'lotPending'>;

function record(s: Stats, scored: number, conceded: number) {
  s.played++;
  s.goalsFor += scored;
  s.goalsAgainst += conceded;
  s.diff = s.goalsFor - s.goalsAgainst;
  if (scored > conceded) {
    s.won++;
    s.points += 3;
  } else if (scored === conceded) {
    s.drawn++;
    s.points += 1;
  } else s.lost++;
}

function tally(names: string[], matches: Match[]): Map<string, Stats> {
  const map = new Map<string, Stats>(
    names.map((team) => [team, { team, played: 0, won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0, diff: 0, points: 0 }]),
  );
  for (const x of matches) {
    if (!isFinished(x)) continue;
    const home = map.get(x.home);
    const away = map.get(x.away);
    if (!home || !away) continue;
    record(home, x.homeGoals!, x.awayGoals!);
    record(away, x.awayGoals!, x.homeGoals!);
  }
  return map;
}

export function computeStandings(teams: Team[], matches: Match[], group: Group): GroupTable {
  const groupTeams = teams.filter((t) => t.group === group);
  const groupMatches = matches.filter((x) => x.group === group);
  const lots = new Map(groupTeams.map((t) => [t.name, t.lot]));
  const lotOf = (s: Stats) => lots.get(s.team) ?? null;
  const all = [...tally(groupTeams.map((t) => t.name), groupMatches).values()].sort(
    (a, b) => b.points - a.points || b.diff - a.diff,
  );

  const rows: StandingRow[] = [];
  for (let i = 0; i < all.length; ) {
    let j = i + 1;
    while (j < all.length && all[j].points === all[i].points && all[j].diff === all[i].diff) j++;
    const bucket = all.slice(i, j);
    const names = bucket.map((s) => s.team);
    const h2h = tally(names, groupMatches.filter((x) => names.includes(x.home) && names.includes(x.away)));
    const byTiebreak = (a: Stats, b: Stats) => {
      const ha = h2h.get(a.team)!;
      const hb = h2h.get(b.team)!;
      return hb.points - ha.points || hb.diff - ha.diff || b.goalsFor - a.goalsFor;
    };
    const byLot = (a: Stats, b: Stats) => {
      const la = lotOf(a);
      const lb = lotOf(b);
      if (la === lb) return 0;
      if (la === null) return 1;
      if (lb === null) return -1;
      return la - lb;
    };
    const tied = (a: Stats, b: Stats) =>
      byTiebreak(a, b) === 0 && (lotOf(a) === null || lotOf(b) === null || lotOf(a) === lotOf(b));
    bucket.sort((a, b) => byTiebreak(a, b) || byLot(a, b));
    bucket.forEach((s, k) =>
      rows.push({
        ...s,
        rank: rows.length + 1,
        lotPending: (k > 0 && tied(s, bucket[k - 1])) || (k < bucket.length - 1 && tied(s, bucket[k + 1])),
      }),
    );
    i = j;
  }
  return { group, rows, complete: groupMatches.length > 0 && groupMatches.every(isFinished) };
}
```

- [ ] **Step 4: Tests laufen lassen**

Run: `npm test -- src/domain/standings.test.ts`
Expected: PASS (6 Tests).

- [ ] **Step 5: Commit**

```bash
git add src/domain/standings.ts src/domain/standings.test.ts
git commit -m "feat: Gruppentabellen mit direktem Vergleich und Los" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Platzhalter-Auflösung und Endstand

**Files:**
- Create: `src/domain/bracket.ts`
- Modify: `src/domain/fixtures.ts` (Helfer `groupTable` ergänzen)
- Test: `src/domain/bracket.test.ts`

**Interfaces:**
- Consumes: `Match`, `GroupTable`, `ResolvedMatch`, `Side`, `isFinished`; Helfer `m`, `ko` aus `fixtures.ts`.
- Produces: `resolveMatches(matches: Match[], tables: GroupTable[]): ResolvedMatch[]` (gleiche Reihenfolge wie Eingabe), `finalRanking(resolved: ResolvedMatch[], teamCount: number): (string | null)[]`.

Regeln: `A1`–`B5` werden nur aufgelöst, wenn die Gruppe `complete` ist und die Zeile nicht `lotPending` ist; sonst Label `A1` bzw. `A1 (Los ausstehend)`. `Sieger/Verlierer HFx` werden aus dem Spiel mit Runde `Halbfinale x` aufgelöst, sobald es einen Sieger hat. Ein beendetes K.-o.-Spiel mit Gleichstand ist `undecided`. Endstand: Runde `Finale` → Plätze 1/2, `Spiel um Platz n` → Plätze n/n+1.

- [ ] **Step 1: Helfer `groupTable` in `src/domain/fixtures.ts` ergänzen**

Import-Zeile ersetzen und Helfer anhängen:
```ts
import type { Group, GroupTable, Match, Settings, Team } from './types';
```
```ts
/** Fertige Tabelle in der angegebenen Reihenfolge, ohne Statistik */
export const groupTable = (group: Group, names: string[], complete = true, pending: number[] = []): GroupTable => ({
  group,
  complete,
  rows: names.map((team, i) => ({
    team, rank: i + 1, played: 4, won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0, diff: 0, points: 0,
    lotPending: pending.includes(i),
  })),
});
```

- [ ] **Step 2: Failing Tests schreiben**

`src/domain/bracket.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { finalRanking, resolveMatches } from './bracket';
import { groupTable, ko, m } from './fixtures';

const A = ['a1', 'a2', 'a3', 'a4', 'a5'];
const B = ['b1', 'b2', 'b3', 'b4', 'b5'];

describe('resolveMatches', () => {
  it('löst Gruppenplätze erst nach Gruppenende auf', () => {
    const [x] = resolveMatches([ko(22, 'Halbfinale 1', 'A1', 'B2')], [groupTable('A', A, false), groupTable('B', B, true)]);
    expect(x.homeSide).toEqual({ team: null, label: 'A1' });
    expect(x.awaySide).toEqual({ team: 'b2', label: 'b2' });
  });

  it('zeigt „Los ausstehend“ statt eines unklaren Platzes', () => {
    const [x] = resolveMatches([ko(22, 'Halbfinale 1', 'A1', 'B2')], [groupTable('A', A, true, [0, 1]), groupTable('B', B)]);
    expect(x.homeSide).toEqual({ team: null, label: 'A1 (Los ausstehend)' });
  });

  it('löst Sieger und Verlierer der Halbfinals auf', () => {
    const tables = [groupTable('A', A), groupTable('B', B)];
    const res = resolveMatches([
      ko(22, 'Halbfinale 1', 'A1', 'B2', [2, 3]),
      ko(24, 'Halbfinale 2', 'A2', 'B1'),
      ko(26, 'Spiel um Platz 3', 'Verlierer HF1', 'Verlierer HF2'),
      ko(27, 'Finale', 'Sieger HF1', 'Sieger HF2'),
    ], tables);
    expect(res[0]).toMatchObject({ winner: 'b2', loser: 'a1', undecided: false });
    expect(res[2].homeSide).toEqual({ team: 'a1', label: 'a1' });
    expect(res[2].awaySide).toEqual({ team: null, label: 'Verlierer HF2' });
    expect(res[3].homeSide).toEqual({ team: 'b2', label: 'b2' });
  });

  it('lässt den Sieger bei Unentschieden im K.-o.-Spiel offen', () => {
    const res = resolveMatches(
      [ko(22, 'Halbfinale 1', 'A1', 'B2', [1, 1]), ko(27, 'Finale', 'Sieger HF1', 'Sieger HF2')],
      [groupTable('A', A), groupTable('B', B)],
    );
    expect(res[0]).toMatchObject({ winner: null, undecided: true });
    expect(res[1].homeSide.label).toBe('Sieger HF1');
  });

  it('markiert ein Unentschieden im Gruppenspiel nicht als unentschieden-offen', () => {
    const [x] = resolveMatches([m(1, 'a1', 'a2', [1, 1])], [groupTable('A', A, false)]);
    expect(x).toMatchObject({ homeSide: { team: 'a1', label: 'a1' }, winner: null, undecided: false });
  });
});

describe('finalRanking', () => {
  it('ermittelt Platz 1–10 aus den Finalrundenspielen', () => {
    const res = resolveMatches([
      ko(21, 'Spiel um Platz 9', 'A5', 'B5', [0, 1]),
      ko(22, 'Halbfinale 1', 'A1', 'B2', [1, 0]),
      ko(23, 'Spiel um Platz 7', 'A4', 'B4', [2, 0]),
      ko(24, 'Halbfinale 2', 'A2', 'B1', [0, 2]),
      ko(25, 'Spiel um Platz 5', 'A3', 'B3', [6, 5]),
      ko(26, 'Spiel um Platz 3', 'Verlierer HF1', 'Verlierer HF2', [1, 0]),
      ko(27, 'Finale', 'Sieger HF1', 'Sieger HF2', [3, 2]),
    ], [groupTable('A', A), groupTable('B', B)]);
    expect(finalRanking(res, 10)).toEqual(['a1', 'b1', 'b2', 'a2', 'a3', 'b3', 'a4', 'b4', 'b5', 'a5']);
  });

  it('lässt offene Plätze leer', () => {
    const res = resolveMatches([ko(27, 'Finale', 'Sieger HF1', 'Sieger HF2')], [groupTable('A', A), groupTable('B', B)]);
    expect(finalRanking(res, 10)).toEqual(Array(10).fill(null));
  });

  it('ignoriert Plätze jenseits der Teamanzahl', () => {
    const res = resolveMatches([ko(21, 'Spiel um Platz 9', 'a1', 'a2', [1, 0])], []);
    expect(finalRanking(res, 4)).toEqual([null, null, null, null]);
  });
});
```

- [ ] **Step 3: Tests laufen lassen**

Run: `npm test -- src/domain/bracket.test.ts`
Expected: FAIL, Modul `./bracket` fehlt.

- [ ] **Step 4: Implementierung**

`src/domain/bracket.ts`:
```ts
import type { GroupTable, Match, ResolvedMatch, Side } from './types';
import { isFinished } from './types';

function groupSlot(raw: string, tables: GroupTable[]): Side | null {
  const slot = /^([AB])([1-5])$/.exec(raw);
  if (!slot) return null;
  const table = tables.find((t) => t.group === slot[1]);
  const row = table?.rows[Number(slot[2]) - 1];
  if (!table?.complete || !row) return { team: null, label: raw };
  if (row.lotPending) return { team: null, label: `${raw} (Los ausstehend)` };
  return { team: row.team, label: row.team };
}

function decide(x: Match, homeSide: Side, awaySide: Side): ResolvedMatch {
  let winner: string | null = null;
  let loser: string | null = null;
  let undecided = false;
  if (isFinished(x) && homeSide.team && awaySide.team) {
    if (x.homeGoals! > x.awayGoals!) [winner, loser] = [homeSide.team, awaySide.team];
    else if (x.homeGoals! < x.awayGoals!) [winner, loser] = [awaySide.team, homeSide.team];
    else undecided = x.group === null;
  }
  return { ...x, homeSide, awaySide, winner, loser, undecided };
}

export function resolveMatches(matches: Match[], tables: GroupTable[]): ResolvedMatch[] {
  const semis = new Map<string, ResolvedMatch>();
  const side = (raw: string): Side => {
    const g = groupSlot(raw, tables);
    if (g) return g;
    const k = /^(Sieger|Verlierer) HF([12])$/.exec(raw);
    if (k) {
      const semi = semis.get(k[2]);
      const team = semi ? (k[1] === 'Sieger' ? semi.winner : semi.loser) : null;
      return { team, label: team ?? raw };
    }
    return { team: raw, label: raw };
  };
  // Halbfinals zuerst, weil Platz 3 und Finale von ihnen abhängen
  for (const x of matches) {
    const hf = /^Halbfinale ([12])$/.exec(x.round);
    if (hf) semis.set(hf[1], decide(x, side(x.home), side(x.away)));
  }
  return matches.map((x) => decide(x, side(x.home), side(x.away)));
}

export function finalRanking(resolved: ResolvedMatch[], teamCount: number): (string | null)[] {
  const out: (string | null)[] = Array(teamCount).fill(null);
  for (const x of resolved) {
    if (x.group !== null || !x.winner) continue;
    const place = x.round === 'Finale' ? 1 : Number(/^Spiel um Platz (\d+)$/.exec(x.round)?.[1]);
    if (place >= 1 && place < teamCount) {
      out[place - 1] = x.winner;
      out[place] = x.loser;
    }
  }
  return out;
}
```

- [ ] **Step 5: Tests laufen lassen**

Run: `npm test -- src/domain/bracket.test.ts`
Expected: PASS (8 Tests).

- [ ] **Step 6: Commit**

```bash
git add src/domain/bracket.ts src/domain/bracket.test.ts src/domain/fixtures.ts
git commit -m "feat: Platzhalter-Auflösung und Endstand" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Pausen-Übersicht

**Files:**
- Create: `src/domain/rest.ts`
- Modify: `src/domain/fixtures.ts` (Helfer `scheduled` ergänzen)
- Test: `src/domain/rest.test.ts`

**Interfaces:**
- Consumes: `Team`, `ScheduledMatch`, `RestEntry`; `formatTime` aus `schedule.ts`; Helfer `team`.
- Produces: `restOverview(teams: Team[], matches: ScheduledMatch[], live: number | null, ranking: (string | null)[]): RestEntry[]`, `restLabel(e: RestEntry): string`.

Regeln (Spec Abschnitt 4): k = Index des nächsten Spiels ohne Ergebnis, in dem das Team auf einer **aufgelösten** Seite steht. k = L → `playing`; k = L+1 → `next`; k > L+1 → `resting` mit `gap = k − L − 1` und Uhrzeit von Spiel k. Kein k: Endplatz bekannt → `done` mit Platz; sonst gibt es noch ein offenes Spiel mit unaufgelöster Seite → `waiting`; sonst `done` ohne Platz. Sortierung: nach k, dann `waiting`, dann `done`; bei Gleichstand alphabetisch.

- [ ] **Step 1: Helfer `scheduled` in `src/domain/fixtures.ts` ergänzen**

Import-Zeile ersetzen und Helfer anhängen:
```ts
import type { Group, GroupTable, Match, ScheduledMatch, Settings, Team } from './types';
```
```ts
/** Geplantes Spiel; null als Team = unaufgelöster Platzhalter */
export const scheduled = (index: number, home: string | null, away: string | null, finished = false): ScheduledMatch => ({
  nr: index + 1, round: 'Test', group: null,
  home: home ?? 'A1', away: away ?? 'B2',
  homeGoals: finished ? 1 : null, awayGoals: finished ? 0 : null,
  homeSide: { team: home, label: home ?? 'A1' }, awaySide: { team: away, label: away ?? 'B2' },
  winner: null, loser: null, undecided: false,
  index, startMinutes: 840 + index * 12, finished,
});
```

- [ ] **Step 2: Failing Tests schreiben**

`src/domain/rest.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { scheduled, team } from './fixtures';
import { restLabel, restOverview } from './rest';
import type { RestEntry } from './types';

const teams = ['a', 'b', 'c', 'd', 'e', 'f'].map((n) => team(n, 'A'));

describe('restOverview', () => {
  const matches = [
    scheduled(0, 'a', 'b', true),
    scheduled(1, 'c', 'd'),
    scheduled(2, 'a', 'e'),
    scheduled(3, 'b', 'f'),
    scheduled(4, 'c', 'b'),
  ];
  const rest = restOverview(teams, matches, 1, Array(6).fill(null));
  const by = (n: string) => rest.find((r) => r.team === n)!;

  it('erkennt spielt jetzt, nächstes Spiel und Pause mit Anzahl und Uhrzeit', () => {
    expect(by('c')).toMatchObject({ status: 'playing', matchIndex: 1 });
    expect(by('a')).toMatchObject({ status: 'next', matchIndex: 2 });
    expect(by('b')).toMatchObject({ status: 'resting', gap: 1, matchIndex: 3, startMinutes: 876 });
  });

  it('sortiert aufsteigend nach dem nächsten Spiel, alphabetisch bei Gleichstand', () => {
    expect(rest.map((r) => r.team)).toEqual(['c', 'd', 'a', 'e', 'b', 'f']);
  });

  it('meldet „wartet auf Finalrunde“, solange Platzhalter offen sind', () => {
    const r = restOverview(teams, [scheduled(0, 'a', 'b', true), scheduled(1, null, null)], 1, Array(6).fill(null));
    expect(r.find((x) => x.team === 'a')!.status).toBe('waiting');
  });

  it('meldet „fertig“ mit Endplatz, auch wenn andere noch warten', () => {
    const ranking = [null, null, null, null, 'a', 'b'];
    const r = restOverview(teams, [scheduled(0, 'a', 'b', true), scheduled(1, null, null)], 1, ranking);
    expect(r.find((x) => x.team === 'a')).toMatchObject({ status: 'done', place: 5 });
    expect(r.at(-1)!.status).toBe('done');
  });

  it('meldet „fertig“ ohne Platz, wenn nichts mehr offen ist', () => {
    const r = restOverview(teams, [scheduled(0, 'a', 'b', true)], null, Array(6).fill(null));
    expect(r.every((x) => x.status === 'done' && x.place === null)).toBe(true);
  });
});

describe('restLabel', () => {
  const e = (over: Partial<RestEntry>): RestEntry => ({
    team: 't', status: 'resting', gap: 0, matchIndex: null, startMinutes: null, place: null, ...over,
  });

  it('formuliert die Texte laut Spec', () => {
    expect(restLabel(e({ status: 'playing' }))).toBe('spielt jetzt');
    expect(restLabel(e({ status: 'next' }))).toBe('nächstes Spiel');
    expect(restLabel(e({ gap: 1, startMinutes: 876 }))).toBe('noch 1 Spiel Pause · 14:36 Uhr');
    expect(restLabel(e({ gap: 3, startMinutes: 900 }))).toBe('noch 3 Spiele Pause · 15:00 Uhr');
    expect(restLabel(e({ gap: 2 }))).toBe('noch 2 Spiele Pause');
    expect(restLabel(e({ status: 'waiting' }))).toBe('wartet auf Finalrunde');
    expect(restLabel(e({ status: 'done', place: 3 }))).toBe('fertig · Platz 3');
    expect(restLabel(e({ status: 'done' }))).toBe('fertig');
  });
});
```

- [ ] **Step 3: Tests laufen lassen**

Run: `npm test -- src/domain/rest.test.ts`
Expected: FAIL, Modul `./rest` fehlt.

- [ ] **Step 4: Implementierung**

`src/domain/rest.ts`:
```ts
import { formatTime } from './schedule';
import type { RestEntry, ScheduledMatch, Team } from './types';

export function restOverview(
  teams: Team[],
  matches: ScheduledMatch[],
  live: number | null,
  ranking: (string | null)[],
): RestEntry[] {
  const unresolvedOpen = matches.some((x) => !x.finished && (!x.homeSide.team || !x.awaySide.team));
  const entries = teams.map(({ name }): RestEntry => {
    const k = live === null ? -1 : matches.findIndex((x) => !x.finished && (x.homeSide.team === name || x.awaySide.team === name));
    if (live !== null && k !== -1) {
      const status = k === live ? 'playing' : k === live + 1 ? 'next' : 'resting';
      return { team: name, status, gap: Math.max(0, k - live - 1), matchIndex: k, startMinutes: matches[k].startMinutes, place: null };
    }
    const placeIdx = ranking.indexOf(name);
    const place = placeIdx === -1 ? null : placeIdx + 1;
    const status = place === null && unresolvedOpen ? 'waiting' : 'done';
    return { team: name, status, gap: 0, matchIndex: null, startMinutes: null, place: status === 'done' ? place : null };
  });
  const key = (e: RestEntry) => e.matchIndex ?? (e.status === 'waiting' ? 1e6 : 2e6);
  return entries.sort((a, b) => key(a) - key(b) || a.team.localeCompare(b.team, 'de'));
}

export function restLabel(e: RestEntry): string {
  switch (e.status) {
    case 'playing':
      return 'spielt jetzt';
    case 'next':
      return 'nächstes Spiel';
    case 'resting': {
      const text = `noch ${e.gap} ${e.gap === 1 ? 'Spiel' : 'Spiele'} Pause`;
      return e.startMinutes === null ? text : `${text} · ${formatTime(e.startMinutes)} Uhr`;
    }
    case 'waiting':
      return 'wartet auf Finalrunde';
    case 'done':
      return e.place ? `fertig · Platz ${e.place}` : 'fertig';
  }
}
```

- [ ] **Step 5: Tests laufen lassen**

Run: `npm test -- src/domain/rest.test.ts`
Expected: PASS (6 Tests).

- [ ] **Step 6: Commit**

```bash
git add src/domain/rest.ts src/domain/rest.test.ts src/domain/fixtures.ts
git commit -m "feat: Pausen-Übersicht" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Torschützenliste

**Files:**
- Create: `src/domain/scorers.ts`
- Test: `src/domain/scorers.test.ts`

**Interfaces:**
- Consumes: `Player`, `ScorerRow`.
- Produces: `scorerList(players: Player[]): ScorerRow[]`.

- [ ] **Step 1: Failing Test schreiben**

`src/domain/scorers.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { scorerList } from './scorers';

describe('scorerList', () => {
  it('sortiert nach Toren, dann alphabetisch, mit geteilten Rängen und ohne 0-Tore-Spieler', () => {
    const list = scorerList([
      { name: 'Zenzi', team: 'x', goals: 2 },
      { name: 'Anton', team: 'y', goals: 2 },
      { name: 'Ödön', team: 'y', goals: 1 },
      { name: 'Berta', team: 'x', goals: 5 },
      { name: 'Null', team: 'x', goals: 0 },
    ]);
    expect(list.map((s) => [s.rank, s.name])).toEqual([[1, 'Berta'], [2, 'Anton'], [2, 'Zenzi'], [4, 'Ödön']]);
  });
});
```

- [ ] **Step 2: Test laufen lassen**

Run: `npm test -- src/domain/scorers.test.ts`
Expected: FAIL, Modul `./scorers` fehlt.

- [ ] **Step 3: Implementierung**

`src/domain/scorers.ts`:
```ts
import type { Player, ScorerRow } from './types';

export function scorerList(players: Player[]): ScorerRow[] {
  const sorted = players
    .filter((p) => p.goals > 0)
    .sort((a, b) => b.goals - a.goals || a.name.localeCompare(b.name, 'de'));
  return sorted.map((p) => ({ ...p, rank: sorted.findIndex((q) => q.goals === p.goals) + 1 }));
}
```

- [ ] **Step 4: Test laufen lassen**

Run: `npm test -- src/domain/scorers.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/domain/scorers.ts src/domain/scorers.test.ts
git commit -m "feat: Torschützenliste mit geteilten Rängen" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: Snapshot

**Files:**
- Create: `src/domain/snapshot.ts`
- Test: `src/domain/snapshot.test.ts`

**Interfaces:**
- Consumes: `computeStandings`, `resolveMatches`, `finalRanking`, `sortByNr`, `plannedStart`, `findLive`, `findNext`, `findLast`, `restOverview`, `scorerList`, `isFinished`; in Tests `planRows` aus `tools/schedule-gen.ts` und `parseTournament`.
- Produces: `buildSnapshot(data: TournamentData, parseWarnings?: string[]): Snapshot`.

- [ ] **Step 1: Failing Tests schreiben**

`src/domain/snapshot.test.ts`:
```ts
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { planRows, type Slot } from '../../tools/schedule-gen';
import { parseTournament, SHEET_NAMES, type RawSheets } from '../data/parse';
import { settings, team } from './fixtures';
import { buildSnapshot } from './snapshot';
import type { Group, TournamentData } from './types';

function fullTournament(score: (nr: number) => [number, number] | null): TournamentData {
  const name = (s: Slot | string) => (typeof s === 'string' ? s : `Team ${s.group}${s.i + 1}`);
  const teams = (['A', 'B'] as const).flatMap((g) => [0, 1, 2, 3, 4].map((i) => team(`Team ${g}${i + 1}`, g)));
  const matches = planRows().map((r) => {
    const sc = score(r.nr);
    const g = /^Gruppe ([AB])$/.exec(r.round);
    return {
      nr: r.nr, round: r.round, group: g ? (g[1] as Group) : null, home: name(r.home), away: name(r.away),
      homeGoals: sc ? sc[0] : null, awayGoals: sc ? sc[1] : null,
    };
  });
  return { settings: settings(), teams, matches, players: [] };
}

describe('buildSnapshot', () => {
  it('setzt die Demo-Daten zu einem stimmigen Zwischenstand zusammen', () => {
    const raw = Object.fromEntries(
      SHEET_NAMES.map((s) => [s, readFileSync(new URL(`../../public/demo/${s}.csv`, import.meta.url), 'utf8')]),
    ) as RawSheets;
    const { data, warnings } = parseTournament(raw);
    const s = buildSnapshot(data, warnings);
    expect(s.liveIndex).toBe(11);
    expect(s.matches[11]).toMatchObject({ nr: 12, startMinutes: 840 + 11 * 12 });
    expect(s.nextIndices).toEqual([12, 13]);
    expect(s.lastIndex).toBe(10);
    expect(s.tables[0].rows[0].team).toBe('FC Bierbauch');
    expect(s.tables[1].rows[0].team).toBe('Trachtler');
    expect(s.rest.slice(0, 2).map((r) => r.status)).toEqual(['playing', 'playing']);
    expect(s.rest.slice(0, 2).map((r) => r.team).sort()).toEqual(['Feuerwehr', 'Kegelclub']);
    expect(s.matches[21].homeSide).toEqual({ team: null, label: 'A1' });
    expect(s.scorers[0].rank).toBe(1);
    expect(s.champion).toBeNull();
    expect(s.warnings).toEqual([]);
  });

  it('ermittelt nach dem letzten Spiel Endstand und Turniersieger', () => {
    const s = buildSnapshot(fullTournament(() => [1, 0]));
    expect(s.liveIndex).toBeNull();
    expect(s.ranking).toEqual([
      'Team A1', 'Team A2', 'Team B2', 'Team B1', 'Team A3', 'Team B3', 'Team A4', 'Team B4', 'Team A5', 'Team B5',
    ]);
    expect(s.champion).toBe('Team A1');
    expect(s.rest.every((r) => r.status === 'done' && r.place !== null)).toBe(true);
    expect(s.rest[0]).toMatchObject({ team: 'Team A1', place: 1 });
  });

  it('warnt bei Unentschieden im K.-o.-Spiel und übernimmt Parser-Warnungen', () => {
    const s = buildSnapshot(fullTournament((nr) => (nr === 22 ? [2, 2] : nr <= 22 ? [1, 0] : null)), ['vom Parser']);
    expect(s.warnings).toEqual(['vom Parser', 'Spiel 22: Unentschieden im K.-o.-Spiel – Sieger unbestimmt.']);
    expect(s.matches[25].homeSide.label).toBe('Verlierer HF1');
  });
});
```

Hinweis zur Sortierung von `rest` im zweiten Test: alle Teams sind `done` und haben denselben Sortierschlüssel, daher alphabetisch → `Team A1` zuerst.

- [ ] **Step 2: Tests laufen lassen**

Run: `npm test -- src/domain/snapshot.test.ts`
Expected: FAIL, Modul `./snapshot` fehlt.

- [ ] **Step 3: Implementierung**

`src/domain/snapshot.ts`:
```ts
import { finalRanking, resolveMatches } from './bracket';
import { restOverview } from './rest';
import { findLast, findLive, findNext, plannedStart, sortByNr } from './schedule';
import { scorerList } from './scorers';
import { computeStandings } from './standings';
import type { ScheduledMatch, Snapshot, TournamentData } from './types';
import { isFinished } from './types';

export function buildSnapshot(data: TournamentData, parseWarnings: string[] = []): Snapshot {
  const warnings = [...parseWarnings];
  const tables = (['A', 'B'] as const).map((g) => computeStandings(data.teams, data.matches, g));
  const resolved = resolveMatches(sortByNr(data.matches), tables);
  const matches: ScheduledMatch[] = resolved.map((x, index) => ({
    ...x, index, startMinutes: plannedStart(index, data.settings), finished: isFinished(x),
  }));
  for (const x of matches) if (x.undecided) warnings.push(`Spiel ${x.nr}: Unentschieden im K.-o.-Spiel – Sieger unbestimmt.`);
  const liveIndex = findLive(matches);
  const ranking = finalRanking(resolved, data.teams.length);
  return {
    settings: data.settings,
    tables,
    matches,
    liveIndex,
    nextIndices: findNext(matches, liveIndex),
    lastIndex: findLast(matches),
    rest: restOverview(data.teams, matches, liveIndex, ranking),
    scorers: scorerList(data.players),
    ranking,
    champion: liveIndex === null ? (ranking[0] ?? null) : null,
    warnings,
  };
}
```

- [ ] **Step 4: Alle Tests und Typprüfung**

Run: `npm test`
Expected: PASS (alle Testdateien).

Run: `npm run check`
Expected: 0 errors.

- [ ] **Step 5: Commit**

```bash
git add src/domain/snapshot.ts src/domain/snapshot.test.ts
git commit -m "feat: Snapshot aus allen Domain-Modulen" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 10: Daten laden

**Files:**
- Create: `src/data/config.ts`, `src/data/sheets.ts`
- Test: `src/data/sheets.test.ts`

**Interfaces:**
- Consumes: `SHEET_NAMES`, `SheetName`, `RawSheets` aus `parse.ts`.
- Produces: `SHEET_ID: string`, `REFRESH_MS: number`, `sheetUrl(sheetId: string, sheet: SheetName, base: string): string`, `fetchSheets(sheetId: string, base: string, fetchFn?: typeof fetch): Promise<RawSheets>`.

- [ ] **Step 1: Konfiguration anlegen**

`src/data/config.ts`:
```ts
/** ID der Google-Tabelle (aus der URL zwischen /d/ und /edit). Leer = Demo-Daten aus public/demo/. */
export const SHEET_ID = '';

export const REFRESH_MS = 30_000;
```

- [ ] **Step 2: Failing Tests schreiben**

`src/data/sheets.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { fetchSheets, sheetUrl } from './sheets';

describe('sheetUrl', () => {
  it('baut die gviz-CSV-URL mit kodiertem Blattnamen', () => {
    expect(sheetUrl('abc', 'Spielplan', '/x/')).toBe(
      'https://docs.google.com/spreadsheets/d/abc/gviz/tq?tqx=out:csv&headers=1&sheet=Spielplan',
    );
  });

  it('nutzt ohne Sheet-ID die Demo-Dateien unter base', () => {
    expect(sheetUrl('', 'Teams', '/Stammtisch-Turnier/')).toBe('/Stammtisch-Turnier/demo/Teams.csv');
  });
});

describe('fetchSheets', () => {
  it('lädt alle 4 Blätter mit Timeout-Signal und ohne Cache', async () => {
    const calls: [string, RequestInit | undefined][] = [];
    const fake = (async (url: string, init?: RequestInit) => {
      calls.push([url, init]);
      return new Response(`csv:${url.split('/').pop()}`);
    }) as typeof fetch;
    const raw = await fetchSheets('', '/', fake);
    expect(raw.Spieler).toBe('csv:Spieler.csv');
    expect(calls).toHaveLength(4);
    expect(calls[0][1]?.cache).toBe('no-store');
    expect(calls[0][1]?.signal).toBeInstanceOf(AbortSignal);
  });

  it('wirft bei HTTP-Fehlern', async () => {
    const fake = (async () => new Response('', { status: 404 })) as typeof fetch;
    await expect(fetchSheets('', '/', fake)).rejects.toThrow('HTTP 404');
  });
});
```

- [ ] **Step 3: Tests laufen lassen**

Run: `npm test -- src/data/sheets.test.ts`
Expected: FAIL, Modul `./sheets` fehlt.

- [ ] **Step 4: Implementierung**

`src/data/sheets.ts`:
```ts
import { SHEET_NAMES, type RawSheets, type SheetName } from './parse';

const TIMEOUT_MS = 15_000;

export function sheetUrl(sheetId: string, sheet: SheetName, base: string): string {
  if (!sheetId) return `${base}demo/${sheet}.csv`;
  return `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv&headers=1&sheet=${encodeURIComponent(sheet)}`;
}

export async function fetchSheets(sheetId: string, base: string, fetchFn: typeof fetch = fetch): Promise<RawSheets> {
  const texts = await Promise.all(
    SHEET_NAMES.map(async (sheet) => {
      // Timeout, damit eine hängende Anfrage die Refresh-Schleife nicht blockiert
      const res = await fetchFn(sheetUrl(sheetId, sheet, base), { cache: 'no-store', signal: AbortSignal.timeout(TIMEOUT_MS) });
      if (!res.ok) throw new Error(`Blatt „${sheet}“: HTTP ${res.status}`);
      return res.text();
    }),
  );
  return Object.fromEntries(SHEET_NAMES.map((s, i) => [s, texts[i]])) as RawSheets;
}
```

- [ ] **Step 5: Tests laufen lassen**

Run: `npm test -- src/data/sheets.test.ts`
Expected: PASS (4 Tests).

- [ ] **Step 6: Commit**

```bash
git add src/data/config.ts src/data/sheets.ts src/data/sheets.test.ts
git commit -m "feat: Blätter laden mit Timeout und Demo-Fallback" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 11: App-Rahmen (Kopf, Navigation, Refresh, Fehlerzustände)

**Files:**
- Create: `src/app.css`, `src/ui/format.ts`, `src/ui/components/WarningBox.svelte`, `src/ui/tabs/Now.svelte`, `src/ui/tabs/Schedule.svelte`, `src/ui/tabs/Tables.svelte`, `src/ui/tabs/Final.svelte`, `src/ui/tabs/Scorers.svelte` (Tabs zunächst als Platzhalter)
- Modify: `src/main.ts`, `src/ui/App.svelte` (komplett ersetzen)
- Test: `src/ui/format.test.ts`

**Interfaces:**
- Consumes: `SHEET_ID`, `REFRESH_MS`, `fetchSheets`, `parseTournament`, `buildSnapshot`, `Snapshot`.
- Produces: `ago(ms: number): string`, `clock(ts: number): string`. Jede Tab-Komponente bekommt die Prop `snapshot: Snapshot`; `Now.svelte` zusätzlich `onShowFinal: () => void`. Globale CSS-Klassen: `.card`, `.stack`, `.muted`, `.num`, `.btn`, `.section-title`.

- [ ] **Step 1: Failing Test für `ago` schreiben**

`src/ui/format.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { ago } from './format';

describe('ago', () => {
  it('formuliert die Zeit seit der letzten Aktualisierung', () => {
    expect(ago(2_000)).toBe('gerade eben');
    expect(ago(12_400)).toBe('vor 12 s');
    expect(ago(125_000)).toBe('vor 2 min');
    expect(ago(-500)).toBe('gerade eben');
  });
});
```

Run: `npm test -- src/ui/format.test.ts`
Expected: FAIL, Modul `./format` fehlt.

- [ ] **Step 2: `src/ui/format.ts` implementieren**

```ts
export function ago(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000));
  if (s < 5) return 'gerade eben';
  if (s < 60) return `vor ${s} s`;
  return `vor ${Math.floor(s / 60)} min`;
}

export const clock = (ts: number): string =>
  new Date(ts).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
```

Run: `npm test -- src/ui/format.test.ts`
Expected: PASS.

- [ ] **Step 3: Globale Stile anlegen**

`src/app.css`:
```css
:root {
  --bg: #0b0b0d;
  --surface: #16161a;
  --surface-2: #1f1f25;
  --border: #2a2a31;
  --text: #ffffff;
  --text-muted: #a1a1aa;
  --accent: #e30613; /* nur als Fläche mit weißer Schrift (4.9:1) */
  --accent-text: #ff4d57; /* roter Text auf dunklem Grund (≥ 5.5:1) */
  --radius: 14px;
  --nav-h: 64px;
  color-scheme: dark;
  font-family: system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
  line-height: 1.4;
}

* { box-sizing: border-box; }

body {
  margin: 0;
  background: var(--bg);
  color: var(--text);
  -webkit-font-smoothing: antialiased;
}

button, select { font: inherit; color: inherit; }

.card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 14px 16px;
}

.stack > * + * { margin-top: 8px; }

.section-title {
  font-size: 0.8rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--text-muted);
  margin: 24px 0 8px;
}

.muted { color: var(--text-muted); }
.num { font-variant-numeric: tabular-nums; }

.btn {
  min-height: 44px;
  padding: 0 18px;
  border: 0;
  border-radius: 999px;
  background: var(--accent);
  color: #fff;
  font-weight: 700;
  cursor: pointer;
}

:focus-visible { outline: 2px solid var(--accent-text); outline-offset: 2px; }

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { animation: none !important; transition: none !important; }
}
```

`src/main.ts` ersetzen:
```ts
import { mount } from 'svelte';
import './app.css';
import App from './ui/App.svelte';

mount(App, { target: document.getElementById('app')! });
```

- [ ] **Step 4: Warnhinweis-Komponente**

`src/ui/components/WarningBox.svelte`:
```svelte
<script lang="ts">
  let { warnings }: { warnings: string[] } = $props();
</script>

<details class="warnings">
  <summary>{warnings.length} {warnings.length === 1 ? 'Hinweis' : 'Hinweise'} zu den Daten</summary>
  <ul>
    {#each warnings as w}
      <li>{w}</li>
    {/each}
  </ul>
</details>

<style>
  .warnings {
    margin-top: 12px;
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: 0 14px;
    font-size: 0.85rem;
    color: var(--text-muted);
  }
  summary { min-height: 44px; display: flex; align-items: center; cursor: pointer; }
  ul { margin: 0 0 12px; padding-left: 18px; }
</style>
```

- [ ] **Step 5: Platzhalter-Tabs anlegen** (werden in Task 12–14 ersetzt)

`src/ui/tabs/Schedule.svelte`, `src/ui/tabs/Tables.svelte`, `src/ui/tabs/Final.svelte`, `src/ui/tabs/Scorers.svelte` – jeweils:
```svelte
<script lang="ts">
  import type { Snapshot } from '../../domain/types';
  let { snapshot }: { snapshot: Snapshot } = $props();
</script>

<p class="muted">{snapshot.settings.name}</p>
```

`src/ui/tabs/Now.svelte`:
```svelte
<script lang="ts">
  import type { Snapshot } from '../../domain/types';
  let { snapshot, onShowFinal }: { snapshot: Snapshot; onShowFinal: () => void } = $props();
</script>

<p class="muted">{snapshot.settings.name}</p>
<button class="btn" onclick={onShowFinal}>Zum Endstand</button>
```

- [ ] **Step 6: `src/ui/App.svelte` komplett ersetzen**

```svelte
<script lang="ts">
  import { onMount } from 'svelte';
  import { REFRESH_MS, SHEET_ID } from '../data/config';
  import { parseTournament } from '../data/parse';
  import { fetchSheets } from '../data/sheets';
  import { buildSnapshot } from '../domain/snapshot';
  import type { Snapshot } from '../domain/types';
  import WarningBox from './components/WarningBox.svelte';
  import { ago, clock } from './format';
  import Final from './tabs/Final.svelte';
  import Now from './tabs/Now.svelte';
  import Schedule from './tabs/Schedule.svelte';
  import Scorers from './tabs/Scorers.svelte';
  import Tables from './tabs/Tables.svelte';

  type TabId = 'now' | 'schedule' | 'tables' | 'final' | 'scorers';
  const TABS: { id: TabId; label: string; icon: string }[] = [
    { id: 'now', label: 'Jetzt', icon: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="3" fill="currentColor"/>' },
    { id: 'schedule', label: 'Spielplan', icon: '<path d="M9 6h11M9 12h11M9 18h11M4 6h.01M4 12h.01M4 18h.01"/>' },
    { id: 'tables', label: 'Tabellen', icon: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 10h18M3 15h18M9 4v16"/>' },
    { id: 'final', label: 'Finale', icon: '<path d="M3 5h5v6h5M3 19h5v-6M13 11v2M13 12h8"/>' },
    { id: 'scorers', label: 'Torschützen', icon: '<circle cx="12" cy="12" r="9"/><path d="M12 7.5l3.8 2.8-1.5 4.4H9.7l-1.5-4.4z"/>' },
  ];

  let tab = $state<TabId>('now');
  let snapshot = $state<Snapshot | null>(null);
  let loadedAt = $state<number | null>(null);
  let failed = $state(false);
  let now = $state(Date.now());
  let loading = false;

  async function refresh() {
    if (loading) return;
    loading = true;
    try {
      const raw = await fetchSheets(SHEET_ID, import.meta.env.BASE_URL);
      const { data, warnings } = parseTournament(raw);
      snapshot = buildSnapshot(data, warnings);
      loadedAt = Date.now();
      failed = false;
    } catch (e) {
      console.error(e);
      failed = true;
    } finally {
      loading = false;
    }
  }

  function show(id: TabId) {
    tab = id;
    window.scrollTo(0, 0);
  }

  onMount(() => {
    refresh();
    const poll = setInterval(refresh, REFRESH_MS);
    const tick = setInterval(() => (now = Date.now()), 1000);
    const onVisible = () => {
      if (document.visibilityState === 'visible') refresh();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(poll);
      clearInterval(tick);
      document.removeEventListener('visibilitychange', onVisible);
    };
  });

  $effect(() => {
    if (snapshot) document.title = snapshot.settings.name;
  });
</script>

<header class="top">
  <img src={`${import.meta.env.BASE_URL}logo.png`} alt="Wappen SV Saaldorf" width="44" height="44" />
  <div class="title">
    <h1>{snapshot?.settings.name ?? 'Stammtischturnier'}</h1>
    <p class="muted">
      {snapshot?.settings.date ?? ''}{#if loadedAt !== null}{snapshot?.settings.date ? ' · ' : ''}aktualisiert {ago(now - loadedAt)}{/if}
    </p>
  </div>
</header>

{#if failed && snapshot && loadedAt !== null}
  <div class="banner" role="status">Offline – Daten von {clock(loadedAt)} Uhr</div>
{/if}

<main>
  {#if snapshot}
    {#if snapshot.warnings.length}<WarningBox warnings={snapshot.warnings} />{/if}
    {#if tab === 'now'}
      <Now {snapshot} onShowFinal={() => show('final')} />
    {:else if tab === 'schedule'}
      <Schedule {snapshot} />
    {:else if tab === 'tables'}
      <Tables {snapshot} />
    {:else if tab === 'final'}
      <Final {snapshot} />
    {:else}
      <Scorers {snapshot} />
    {/if}
  {:else if failed}
    <div class="card error" role="alert">
      <p>Die Turnierdaten konnten nicht geladen werden.</p>
      <button class="btn" onclick={refresh}>Erneut versuchen</button>
    </div>
  {:else}
    <p class="muted loading">Lade Turnierdaten …</p>
  {/if}
</main>

<nav class="tabs" aria-label="Bereiche">
  {#each TABS as t (t.id)}
    <button class:active={tab === t.id} aria-current={tab === t.id ? 'page' : undefined} onclick={() => show(t.id)}>
      <svg viewBox="0 0 24 24" aria-hidden="true">{@html t.icon}</svg>
      <span>{t.label}</span>
    </button>
  {/each}
</nav>

<style>
  .top {
    position: sticky;
    top: 0;
    z-index: 10;
    display: flex;
    align-items: center;
    gap: 12px;
    padding: calc(10px + env(safe-area-inset-top)) 16px 10px;
    background: rgba(11, 11, 13, 0.92);
    backdrop-filter: blur(8px);
    border-bottom: 1px solid var(--border);
  }
  .top img { flex: none; object-fit: contain; }
  .title { min-width: 0; }
  h1 { margin: 0; font-size: 1.05rem; font-weight: 800; overflow-wrap: anywhere; }
  .title p { margin: 2px 0 0; font-size: 0.8rem; }
  .banner {
    margin: 12px 16px 0;
    padding: 10px 14px;
    border-radius: var(--radius);
    background: var(--surface-2);
    border-left: 4px solid var(--accent);
    font-size: 0.9rem;
  }
  main {
    max-width: 640px;
    margin: 0 auto;
    padding: 4px 16px calc(var(--nav-h) + 24px + env(safe-area-inset-bottom));
  }
  .loading { text-align: center; margin-top: 48px; }
  .error { margin-top: 24px; text-align: center; }
  .tabs {
    position: fixed;
    inset: auto 0 0 0;
    z-index: 10;
    display: grid;
    grid-template-columns: repeat(5, 1fr);
    height: calc(var(--nav-h) + env(safe-area-inset-bottom));
    padding-bottom: env(safe-area-inset-bottom);
    background: var(--surface);
    border-top: 1px solid var(--border);
  }
  .tabs button {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 3px;
    min-width: 0;
    border: 0;
    background: none;
    color: var(--text-muted);
    font-size: 0.68rem;
    cursor: pointer;
  }
  .tabs button.active { color: var(--text); }
  .tabs button.active svg { color: var(--accent-text); }
  .tabs svg { width: 24px; height: 24px; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
  .tabs span { max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
</style>
```

- [ ] **Step 7: Prüfen**

Run: `npm test`
Expected: PASS.

Run: `npm run check`
Expected: 0 errors.

Run: `npm run dev`, im Browser `http://localhost:5173/Stammtisch-Turnier/` bei 375 px Breite öffnen.
Expected: Kopf mit Wappen, „Stammtischturnier 2026 (Demo)“, „14.11.2026 · aktualisiert gerade eben“; untere Navigation mit 5 Tabs; Tab-Wechsel funktioniert; kein horizontales Scrollen. Dann `public/demo/Teams.csv` testweise umbenennen → Fehlerkarte mit „Erneut versuchen“; Datei zurückbenennen.

- [ ] **Step 8: Commit**

```bash
git add src
git commit -m "feat: App-Rahmen mit Navigation, Refresh und Fehlerzuständen" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 12: Tab „Jetzt“

**Files:**
- Create: `src/ui/components/LiveBadge.svelte`, `src/ui/components/MatchCard.svelte`, `src/ui/components/RestList.svelte`
- Modify: `src/ui/tabs/Now.svelte` (komplett ersetzen)

**Interfaces:**
- Consumes: `Snapshot`, `ScheduledMatch`, `RestEntry`, `formatTime`, `restLabel`.
- Produces: `MatchCard` mit Props `{ match: ScheduledMatch; live?: boolean }`; `RestList` mit `{ entries: RestEntry[] }`; `LiveBadge` ohne Props. Alle drei sind für die spätere TV-Ansicht wiederverwendbar (keine Abhängigkeit vom Tab).

- [ ] **Step 1: `LiveBadge.svelte`**

```svelte
<span class="live"><span class="dot" aria-hidden="true"></span>LIVE</span>

<style>
  .live {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 3px 9px;
    border-radius: 999px;
    background: var(--accent);
    color: #fff;
    font-size: 0.72rem;
    font-weight: 800;
    letter-spacing: 0.08em;
  }
  .dot { width: 8px; height: 8px; border-radius: 50%; background: #fff; animation: pulse 1.4s ease-in-out infinite; }
  @keyframes pulse {
    0%, 100% { opacity: 1; transform: scale(1); }
    50% { opacity: 0.35; transform: scale(0.7); }
  }
</style>
```

- [ ] **Step 2: `MatchCard.svelte`**

```svelte
<script lang="ts">
  import { formatTime } from '../../domain/schedule';
  import type { ScheduledMatch } from '../../domain/types';
  import LiveBadge from './LiveBadge.svelte';

  let { match, live = false }: { match: ScheduledMatch; live?: boolean } = $props();
  const time = $derived(match.startMinutes === null ? null : `${formatTime(match.startMinutes)} Uhr`);
</script>

<article class="card match" class:live class:done={match.finished && !live}>
  <div class="meta">
    {#if live}<LiveBadge />{/if}
    <span class="round">Spiel {match.nr} · {match.round}</span>
    {#if time}<span class="time num">{live ? `Spielstart geplant: ${time}` : time}</span>{/if}
  </div>
  <div class="teams">
    <span class="team home" class:pending={!match.homeSide.team} class:winner={match.winner !== null && match.winner === match.homeSide.team}>{match.homeSide.label}</span>
    <span class="score num">{match.finished ? `${match.homeGoals} : ${match.awayGoals}` : '–'}</span>
    <span class="team away" class:pending={!match.awaySide.team} class:winner={match.winner !== null && match.winner === match.awaySide.team}>{match.awaySide.label}</span>
  </div>
  {#if match.undecided}<p class="hint">Unentschieden – Sieger unbestimmt</p>{/if}
</article>

<style>
  .match.live { border-color: var(--accent); box-shadow: 0 0 0 1px var(--accent) inset; }
  .match.done { opacity: 0.7; }
  .meta { display: flex; flex-wrap: wrap; align-items: center; gap: 4px 10px; font-size: 0.78rem; color: var(--text-muted); }
  .time { margin-left: auto; }
  .teams { display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; gap: 10px; margin-top: 10px; }
  .team { font-weight: 700; overflow-wrap: anywhere; }
  .home { text-align: right; }
  .live .team { font-size: 1.15rem; }
  .pending { color: var(--text-muted); font-weight: 500; font-style: italic; }
  .winner { color: var(--text); text-decoration: underline; text-decoration-color: var(--accent); text-underline-offset: 4px; }
  .score { min-width: 3.2em; text-align: center; font-size: 1.2rem; font-weight: 800; }
  .live .score { font-size: 1.5rem; }
  .hint { margin: 8px 0 0; font-size: 0.8rem; color: var(--accent-text); }
</style>
```

- [ ] **Step 3: `RestList.svelte`**

```svelte
<script lang="ts">
  import { restLabel } from '../../domain/rest';
  import type { RestEntry } from '../../domain/types';

  let { entries }: { entries: RestEntry[] } = $props();
</script>

<ul class="card rest">
  {#each entries as e (e.team)}
    <li class={e.status}>
      <span class="team">{e.team}</span>
      <span class="status num">{restLabel(e)}</span>
    </li>
  {/each}
</ul>

<style>
  .rest { list-style: none; margin: 0; padding: 4px 16px; }
  li { display: flex; justify-content: space-between; gap: 12px; padding: 10px 0; border-bottom: 1px solid var(--border); }
  li:last-child { border-bottom: 0; }
  .team { font-weight: 600; overflow-wrap: anywhere; }
  .status { text-align: right; font-size: 0.88rem; color: var(--text-muted); flex: none; max-width: 60%; }
  .playing .status { color: var(--accent-text); font-weight: 700; }
  .next .status { color: var(--text); font-weight: 700; }
  .done { opacity: 0.6; }
</style>
```

- [ ] **Step 4: `src/ui/tabs/Now.svelte` ersetzen**

```svelte
<script lang="ts">
  import type { Snapshot } from '../../domain/types';
  import MatchCard from '../components/MatchCard.svelte';
  import RestList from '../components/RestList.svelte';

  let { snapshot, onShowFinal }: { snapshot: Snapshot; onShowFinal: () => void } = $props();
  const live = $derived(snapshot.liveIndex === null ? null : snapshot.matches[snapshot.liveIndex]);
  const next = $derived(snapshot.nextIndices.map((i) => snapshot.matches[i]));
  const last = $derived(snapshot.lastIndex === null ? null : snapshot.matches[snapshot.lastIndex]);
</script>

{#if live}
  <h2 class="section-title">Jetzt</h2>
  <MatchCard match={live} live />
{:else}
  <section class="card champion">
    <p class="muted">Turniersieger</p>
    <p class="name">{snapshot.champion ?? 'steht noch nicht fest'}</p>
    <button class="btn" onclick={onShowFinal}>Zum Endstand</button>
  </section>
{/if}

{#if next.length}
  <h2 class="section-title">Als Nächstes</h2>
  <div class="stack">
    {#each next as x (x.nr)}<MatchCard match={x} />{/each}
  </div>
{/if}

{#if live}
  <h2 class="section-title">Pausen</h2>
  <RestList entries={snapshot.rest} />
{/if}

{#if last}
  <h2 class="section-title">Letztes Ergebnis</h2>
  <MatchCard match={last} />
{/if}

<style>
  .champion {
    margin-top: 16px;
    text-align: center;
    padding: 28px 16px;
    background: linear-gradient(160deg, var(--accent), #7a0309);
    border: 0;
  }
  .champion .muted { color: rgba(255, 255, 255, 0.85); margin: 0; text-transform: uppercase; letter-spacing: 0.1em; font-size: 0.8rem; }
  .name { font-size: 1.6rem; font-weight: 900; margin: 6px 0 18px; overflow-wrap: anywhere; }
  .champion .btn { background: #fff; color: #7a0309; }
</style>
```

- [ ] **Step 5: Prüfen**

Run: `npm run check`
Expected: 0 errors.

Im Dev-Server bei 375 px: LIVE-Karte „Spiel 12 · Gruppe B“, „Feuerwehr – Kegelclub“, „Spielstart geplant: 16:12 Uhr“ (14:00 + 11 × 12 min); „Als Nächstes“ mit Spiel 13 und 14; Pausen-Liste beginnt mit Feuerwehr/Kegelclub „spielt jetzt“, dann Stammtisch Mitte/Saaldorfer Buam „nächstes Spiel“; „Letztes Ergebnis“ Spiel 11 „1 : 0“.

- [ ] **Step 6: Commit**

```bash
git add src/ui
git commit -m "feat: Tab Jetzt mit LIVE-Karte und Pausen-Übersicht" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 13: Tabs „Spielplan“ und „Tabellen“

**Files:**
- Create: `src/ui/components/StandingsTable.svelte`
- Modify: `src/ui/tabs/Schedule.svelte`, `src/ui/tabs/Tables.svelte` (komplett ersetzen)

**Interfaces:**
- Consumes: `Snapshot`, `GroupTable`, `MatchCard`.
- Produces: `StandingsTable` mit Props `{ table: GroupTable }`.

- [ ] **Step 1: `src/ui/tabs/Schedule.svelte` ersetzen**

```svelte
<script lang="ts">
  import type { Snapshot } from '../../domain/types';
  import MatchCard from '../components/MatchCard.svelte';

  let { snapshot }: { snapshot: Snapshot } = $props();

  const KEY = 'stammtisch-team-filter';
  function load(): string {
    try {
      return localStorage.getItem(KEY) ?? '';
    } catch {
      return '';
    }
  }
  let filter = $state(load());
  $effect(() => {
    try {
      if (filter) localStorage.setItem(KEY, filter);
      else localStorage.removeItem(KEY);
    } catch {
      // Speicher gesperrt (z. B. privater Modus): Filter gilt nur für diese Sitzung
    }
  });

  const teamNames = $derived(snapshot.tables.flatMap((t) => t.rows.map((r) => r.team)).sort((a, b) => a.localeCompare(b, 'de')));
  // Gespeicherter Filter auf ein inzwischen umbenanntes Team zeigt wieder alle Spiele
  const active = $derived(teamNames.includes(filter) ? filter : '');
  const shown = $derived(
    active ? snapshot.matches.filter((x) => x.homeSide.team === active || x.awaySide.team === active) : snapshot.matches,
  );
</script>

<label class="filter">
  <span class="muted">Team</span>
  <select bind:value={filter}>
    <option value="">Alle Teams</option>
    {#each teamNames as t (t)}<option value={t}>{t}</option>{/each}
  </select>
</label>

<div class="stack">
  {#each shown as x (x.nr)}
    <MatchCard match={x} live={x.index === snapshot.liveIndex} />
  {/each}
</div>

<style>
  .filter { display: flex; align-items: center; gap: 12px; margin: 16px 0 12px; }
  select {
    flex: 1;
    min-height: 44px;
    padding: 0 12px;
    border-radius: 10px;
    border: 1px solid var(--border);
    background: var(--surface);
  }
</style>
```

- [ ] **Step 2: `StandingsTable.svelte`**

```svelte
<script lang="ts">
  import type { GroupTable } from '../../domain/types';

  let { table }: { table: GroupTable } = $props();
</script>

<section class="card standings">
  <h3>Gruppe {table.group}</h3>
  <div class="scroll">
    <table>
      <thead>
        <tr>
          <th scope="col">Pl.</th>
          <th scope="col" class="team">Team</th>
          <th scope="col">Sp.</th>
          <th scope="col">S</th>
          <th scope="col">U</th>
          <th scope="col">N</th>
          <th scope="col">Tore</th>
          <th scope="col">Diff.</th>
          <th scope="col">Pkt.</th>
        </tr>
      </thead>
      <tbody>
        {#each table.rows as r (r.team)}
          <tr class:semi={r.rank <= 2}>
            <td class="num">{r.rank}</td>
            <td class="team">
              {r.team}{#if table.complete && r.lotPending}<span class="tag">Los ausstehend</span>{/if}
            </td>
            <td class="num">{r.played}</td>
            <td class="num">{r.won}</td>
            <td class="num">{r.drawn}</td>
            <td class="num">{r.lost}</td>
            <td class="num">{r.goalsFor}:{r.goalsAgainst}</td>
            <td class="num">{r.diff > 0 ? '+' : ''}{r.diff}</td>
            <td class="num pts">{r.points}</td>
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
  <p class="legend muted"><span class="swatch" aria-hidden="true"></span>Halbfinale</p>
</section>

<style>
  .standings { padding: 14px 0 10px; }
  h3 { margin: 0 16px 8px; font-size: 1rem; }
  .scroll { overflow-x: auto; }
  table { width: 100%; border-collapse: collapse; font-size: 0.85rem; }
  th { color: var(--text-muted); font-weight: 600; font-size: 0.72rem; padding: 6px 4px; text-align: center; }
  td { padding: 10px 4px; text-align: center; border-top: 1px solid var(--border); }
  th:first-child, td:first-child { padding-left: 16px; }
  th:last-child, td:last-child { padding-right: 16px; }
  .team { text-align: left; font-weight: 600; min-width: 7.5em; }
  .pts { font-weight: 800; }
  tr.semi td:first-child { box-shadow: inset 4px 0 0 var(--accent); }
  .tag { display: block; font-size: 0.7rem; font-weight: 500; color: var(--accent-text); }
  .legend { display: flex; align-items: center; gap: 8px; margin: 8px 16px 0; font-size: 0.75rem; }
  .swatch { width: 4px; height: 14px; background: var(--accent); border-radius: 2px; }
</style>
```

- [ ] **Step 3: `src/ui/tabs/Tables.svelte` ersetzen**

```svelte
<script lang="ts">
  import type { Snapshot } from '../../domain/types';
  import StandingsTable from '../components/StandingsTable.svelte';

  let { snapshot }: { snapshot: Snapshot } = $props();
</script>

<div class="tables">
  {#each snapshot.tables as t (t.group)}<StandingsTable table={t} />{/each}
</div>

<style>
  .tables { display: grid; gap: 12px; margin-top: 16px; }
</style>
```

- [ ] **Step 4: Prüfen**

Run: `npm run check`
Expected: 0 errors.

Im Dev-Server bei 360 px und 375 px: Spielplan zeigt 27 Karten, Spiel 12 hervorgehoben, Spiele 1–11 abgeschwächt, Spiele 22–27 mit kursiven Platzhaltern. Filter „Trachtler“ zeigt nur dessen Spiele; nach Neuladen ist der Filter noch gesetzt. Tabellen: Gruppe A beginnt mit „FC Bierbauch“ (7 Pkt.), Gruppe B mit „Trachtler“ (6 Pkt.); Plätze 1–2 rot markiert; die Seite scrollt nicht horizontal.

- [ ] **Step 5: Commit**

```bash
git add src/ui
git commit -m "feat: Tabs Spielplan (mit Team-Filter) und Tabellen" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 14: Tabs „Finalrunde“ und „Torschützen“

**Files:**
- Modify: `src/ui/tabs/Final.svelte`, `src/ui/tabs/Scorers.svelte` (komplett ersetzen)

**Interfaces:**
- Consumes: `Snapshot`, `MatchCard`.

- [ ] **Step 1: `src/ui/tabs/Final.svelte` ersetzen**

```svelte
<script lang="ts">
  import type { Snapshot } from '../../domain/types';
  import MatchCard from '../components/MatchCard.svelte';

  let { snapshot }: { snapshot: Snapshot } = $props();
  const ko = $derived(snapshot.matches.filter((x) => x.group === null));
  const find = (round: string) => ko.find((x) => x.round === round);
  const semis = $derived(['Halbfinale 1', 'Halbfinale 2'].map(find).filter((x) => x !== undefined));
  const finals = $derived(['Finale', 'Spiel um Platz 3'].map(find).filter((x) => x !== undefined));
  const placements = $derived(ko.filter((x) => !/^Halbfinale [12]$|^Finale$|^Spiel um Platz 3$/.test(x.round)));
</script>

{#if snapshot.liveIndex === null}
  <h2 class="section-title">Endstand</h2>
  <ol class="card ranking">
    {#each snapshot.ranking as team, i}
      <li class:podium={i < 3}>
        <span class="place num">{i + 1}.</span>
        <span>{team ?? '–'}</span>
      </li>
    {/each}
  </ol>
{/if}

{#if semis.length}
  <h2 class="section-title">Halbfinale</h2>
  <div class="stack">
    {#each semis as x (x.nr)}<MatchCard match={x} live={x.index === snapshot.liveIndex} />{/each}
  </div>
{/if}

{#if finals.length}
  <h2 class="section-title">Finale und Platz 3</h2>
  <div class="stack">
    {#each finals as x (x.nr)}<MatchCard match={x} live={x.index === snapshot.liveIndex} />{/each}
  </div>
{/if}

{#if placements.length}
  <h2 class="section-title">Platzierungsspiele</h2>
  <div class="stack">
    {#each placements as x (x.nr)}<MatchCard match={x} live={x.index === snapshot.liveIndex} />{/each}
  </div>
{/if}

<style>
  .ranking { list-style: none; margin: 0; padding: 4px 16px; }
  .ranking li { display: flex; gap: 12px; padding: 10px 0; border-bottom: 1px solid var(--border); font-weight: 600; }
  .ranking li:last-child { border-bottom: 0; }
  .place { width: 2.2em; color: var(--text-muted); }
  .podium { font-size: 1.05rem; }
  .podium .place { color: var(--accent-text); font-weight: 800; }
</style>
```

- [ ] **Step 2: `src/ui/tabs/Scorers.svelte` ersetzen**

```svelte
<script lang="ts">
  import type { Snapshot } from '../../domain/types';

  let { snapshot }: { snapshot: Snapshot } = $props();
</script>

{#if snapshot.scorers.length === 0}
  <p class="muted empty">Noch keine Tore eingetragen.</p>
{:else}
  <ol class="card scorers">
    <!-- ohne Key: gleichnamige Spieler im selben Team dürfen nicht abstürzen -->
    {#each snapshot.scorers as s}
      <li class:top={s.rank <= 3}>
        <span class="rank num">{s.rank}.</span>
        <span class="who">
          <span class="name">{s.name}</span>
          <span class="muted team">{s.team}</span>
        </span>
        <span class="goals num">{s.goals}</span>
      </li>
    {/each}
  </ol>
{/if}

<style>
  .empty { text-align: center; margin-top: 48px; }
  .scorers { list-style: none; margin: 16px 0 0; padding: 4px 16px; }
  li { display: flex; align-items: center; gap: 12px; padding: 10px 0; border-bottom: 1px solid var(--border); }
  li:last-child { border-bottom: 0; }
  .rank { width: 2em; color: var(--text-muted); }
  .who { flex: 1; min-width: 0; display: flex; flex-direction: column; }
  .name { font-weight: 600; overflow-wrap: anywhere; }
  .team { font-size: 0.8rem; }
  .goals { font-size: 1.1rem; font-weight: 800; }
  .top .rank { color: var(--accent-text); font-weight: 800; }
  .top .goals {
    min-width: 2em;
    text-align: center;
    padding: 2px 8px;
    border-radius: 999px;
    background: var(--accent);
    color: #fff;
  }
</style>
```

- [ ] **Step 3: Prüfen**

Run: `npm run check`
Expected: 0 errors.

Im Dev-Server: Finalrunde zeigt Halbfinale (A1–B2, A2–B1 als Platzhalter), Finale/Platz 3 („Sieger HF1“ …), Platzierungsspiele 9, 7, 5; kein Endstand-Block. Torschützen: Huber, Maier, Gruber jeweils Rang 1 mit 3 Toren (alphabetisch: Gruber, Huber, Maier), dann Rang 4; „Quirin Stadler“ (leer = 0) fehlt.

Endzustand testen: in `public/demo/Spielplan.csv` vorübergehend alle Ergebnisse auf `"1","0"` setzen → „Jetzt“ zeigt Siegerkarte „FC Bierbauch“, Button „Zum Endstand“ springt zur Finalrunde mit Platz 1–10. Danach die Datei mit `git checkout public/demo/Spielplan.csv` zurücksetzen.

- [ ] **Step 4: Commit**

```bash
git add src/ui
git commit -m "feat: Tabs Finalrunde (mit Endstand) und Torschützen" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 15: Excel-Vorlage für Google Tabellen

**Files:**
- Create: `tools/template.ts`, `vorlage/stammtisch-turnier.xlsx` (generiert)
- Test: `tools/template.test.ts`

**Interfaces:**
- Consumes: `planRows`, `Slot` aus `tools/schedule-gen.ts`; `SHEET_NAMES` aus `src/data/parse.ts`.
- Produces: `buildWorkbook(): ExcelJS.Workbook`, `teamRow(s: Slot): number`; CLI `npm run template`.

- [ ] **Step 1: Failing Test schreiben**

`tools/template.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { SHEET_NAMES } from '../src/data/parse.ts';
import { buildWorkbook } from './template.ts';

describe('buildWorkbook', () => {
  const wb = buildWorkbook();

  it('hat genau die Blätter, die die App liest', () => {
    expect(wb.worksheets.map((w) => w.name)).toEqual([...SHEET_NAMES]);
  });

  it('enthält 27 Spiele mit Formeln auf das Blatt Teams', () => {
    const plan = wb.getWorksheet('Spielplan')!;
    expect(plan.rowCount).toBe(28);
    expect(plan.getRow(1).values).toEqual([undefined, 'Nr.', 'Runde', 'Heim', 'Gast', 'Tore Heim', 'Tore Gast']);
    expect(plan.getCell('C2').value).toEqual({ formula: 'Teams!A2', result: 'Team A1' });
    expect(plan.getCell('D2').value).toEqual({ formula: 'Teams!A3', result: 'Team A2' });
    expect(plan.getCell('C3').value).toEqual({ formula: 'Teams!A7', result: 'Team B1' });
    expect(plan.getCell('B28').value).toBe('Finale');
    expect(plan.getCell('C28').value).toBe('Sieger HF1');
  });

  it('formatiert alle Einstellungen als Text, damit gviz keine Werte verwirft', () => {
    const s = wb.getWorksheet('Einstellungen')!;
    for (let r = 2; r <= 6; r++) {
      expect(typeof s.getCell(r, 2).value).toBe('string');
      expect(s.getCell(r, 2).numFmt).toBe('@');
    }
    expect(s.getCell('B4').value).toBe('14:00');
  });

  it('hat 10 Beispielteams', () => {
    const t = wb.getWorksheet('Teams')!;
    expect(t.rowCount).toBe(11);
    expect(t.getCell('A7').value).toBe('Team B1');
    expect(t.getCell('B7').value).toBe('B');
  });

  it('lässt sich als xlsx schreiben', async () => {
    const buf = await wb.xlsx.writeBuffer();
    expect(buf.byteLength).toBeGreaterThan(1000);
  });
});
```

- [ ] **Step 2: Test laufen lassen**

Run: `npm test -- tools/template.test.ts`
Expected: FAIL, Modul `./template.ts` fehlt.

- [ ] **Step 3: Implementierung**

`tools/template.ts`:
```ts
import { mkdirSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import ExcelJS from 'exceljs';
import { planRows, type Slot } from './schedule-gen.ts';

/** Zeile im Blatt Teams: A1–A5 in Zeile 2–6, B1–B5 in Zeile 7–11 */
export const teamRow = (s: Slot): number => 2 + (s.group === 'B' ? 5 : 0) + s.i;

function sheet(wb: ExcelJS.Workbook, name: string, columns: [string, number][]): ExcelJS.Worksheet {
  const ws = wb.addWorksheet(name, { views: [{ state: 'frozen', ySplit: 1 }] });
  ws.columns = columns.map(([header, width]) => ({ header, width }));
  ws.getRow(1).font = { bold: true };
  return ws;
}

export function buildWorkbook(): ExcelJS.Workbook {
  const wb = new ExcelJS.Workbook();

  const settings = sheet(wb, 'Einstellungen', [['Feld', 22], ['Wert', 30]]);
  settings.addRows([
    ['Turniername', 'Stammtischturnier 2026'],
    ['Datum', '14.11.2026'],
    ['Startzeit', '14:00'],
    ['Spieldauer (Min.)', '10'],
    ['Pause (Min.)', '2'],
  ]);
  // gviz wählt pro Spalte einen Datentyp und leert Zellen anderer Typen – daher alles als Text
  settings.getColumn(2).numFmt = '@';
  settings.getColumn(2).eachCell((c) => (c.numFmt = '@'));

  const teams = sheet(wb, 'Teams', [['Team', 24], ['Gruppe', 8], ['Los', 6]]);
  for (const g of ['A', 'B'] as const) for (let i = 1; i <= 5; i++) teams.addRow([`Team ${g}${i}`, g, null]);

  const plan = sheet(wb, 'Spielplan', [['Nr.', 6], ['Runde', 18], ['Heim', 24], ['Gast', 24], ['Tore Heim', 10], ['Tore Gast', 10]]);
  const side = (s: Slot | string) =>
    typeof s === 'string' ? s : { formula: `Teams!A${teamRow(s)}`, result: `Team ${s.group}${s.i + 1}` };
  for (const r of planRows()) plan.addRow([r.nr, r.round, side(r.home), side(r.away), null, null]);

  const players = sheet(wb, 'Spieler', [['Name', 24], ['Team', 24], ['Tore', 6]]);
  players.addRow(['Max Mustermann', 'Team A1', 0]);

  return wb;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  mkdirSync('vorlage', { recursive: true });
  await buildWorkbook().xlsx.writeFile('vorlage/stammtisch-turnier.xlsx');
  console.log('vorlage/stammtisch-turnier.xlsx geschrieben');
}
```

- [ ] **Step 4: Test laufen lassen**

Run: `npm test -- tools/template.test.ts`
Expected: PASS (5 Tests). Falls `getRow(1).values` wegen ExcelJS-Interna anders aussieht, die Erwartung auf `plan.getRow(1).values.slice(1)` umstellen – nicht die Implementierung.

- [ ] **Step 5: Vorlage erzeugen**

Run: `npm run template`
Expected: Ausgabe `vorlage/stammtisch-turnier.xlsx geschrieben`, Datei existiert.

- [ ] **Step 6: Commit**

```bash
git add tools/template.ts tools/template.test.ts vorlage/stammtisch-turnier.xlsx
git commit -m "feat: Excel-Vorlage für Google Tabellen" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 16: Deployment und Anleitung

**Files:**
- Create: `.github/workflows/deploy.yml`, `README.md`

- [ ] **Step 1: Workflow anlegen**

`.github/workflows/deploy.yml`:
```yaml
name: Deploy

on:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: true

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v5
      - uses: actions/setup-node@v5
        with:
          node-version: 24
          cache: npm
      - run: npm ci
      - run: npm test
      - run: npm run check
      - run: npm run build
      - uses: actions/upload-pages-artifact@v4
        with:
          path: dist

  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - id: deployment
        uses: actions/deploy-pages@v4
```

- [ ] **Step 2: `README.md` anlegen**

```markdown
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
```

- [ ] **Step 3: Lockfile für Linux prüfen**

Run: `npm ci`
Expected: Erfolgreich. Hinweis: Falls der erste Workflow-Lauf auf GitHub mit „Cannot find native binding“ (rolldown/esbuild) scheitert, hat das unter Windows erzeugte `package-lock.json` die Linux-Binaries nicht aufgenommen. Dann `package-lock.json` löschen, `npm install` neu ausführen und den Lockfile committen.

- [ ] **Step 4: Commit und Push**

```bash
git add .github README.md
git commit -m "ci: GitHub-Pages-Deployment und Anleitung" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
git push
```

Expected: Der Workflow „Deploy“ startet. Er schlägt fehl, solange das Repo privat ist oder Pages nicht auf „GitHub Actions“ steht – das stellt der Repo-Besitzer ein; danach `workflow_dispatch` erneut auslösen.

---

### Task 17: Abschluss-Check und Design-Feinschliff

**Files:**
- Modify (nur bei Befund): `src/app.css`, Styles in `src/ui/**/*.svelte`

- [ ] **Step 1: Design-Review mit Skill**

Den Skill `ui-ux-pro-max:ui-ux-pro-max` laden und die laufende App (Dev-Server, Demo-Daten) bei 360 px und 375 px Breite gegen Spec Abschnitt 5 prüfen: sportlich-dunkel, Vereinsrot als Akzent, Kontraste WCAG AA, Touch-Ziele ≥ 44 px, kein horizontales Scrollen, LIVE-Badge pulsiert (und pausiert bei `prefers-reduced-motion`). Nur CSS anpassen; keine Logik ändern.

- [ ] **Step 2: Funktionsdurchlauf im Browser**

Mit Browser-Tool/Playwright bei 375 px nacheinander prüfen und das Ergebnis notieren:
1. Alle 5 Tabs laden ohne Konsolenfehler.
2. „aktualisiert vor X s“ zählt hoch und springt nach ~30 s zurück auf „gerade eben“.
3. Netzwerk auf offline stellen, 30 s warten → Banner „Offline – Daten von HH:MM Uhr“, Inhalt bleibt sichtbar. Wieder online → Banner verschwindet.
4. Tab wechseln und zurück (`visibilitychange`) löst einen Refresh aus (Netzwerk-Tab zeigt 4 neue Anfragen).

- [ ] **Step 3: Gesamtprüfung**

Run: `npm test`
Expected: PASS, alle Testdateien.

Run: `npm run check`
Expected: 0 errors.

Run: `npm run build`
Expected: Erfolgreich.

- [ ] **Step 4: Commit (falls Änderungen)**

```bash
git add src
git commit -m "style: Feinschliff nach Design-Review" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
git push
```

Der Check gegen eine echte Google-Tabelle (Spec Abschnitt 8) folgt, sobald der Veranstalter die Vorlage importiert und die Sheet-ID geliefert hat: `SHEET_ID` eintragen, eine echte gviz-CSV je Blatt herunterladen und mit den Dateien in `public/demo/` vergleichen (Anführungszeichen, Zahlenformat `3` vs. `3.0`, Uhrzeit `14:00` vs. `14:00:00`).
