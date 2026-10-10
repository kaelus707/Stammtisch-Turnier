# Tabelle rechnet, Webseite zeigt an – Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Die Excel-Vorlage rechnet das komplette Turnier per Formeln durch: Teamcodes, Spielplan mit Phase/Zeit/Sieger, Gruppentabellen mit Fußball-Tiebreak, K.-o.-Auflösung, Turnierbaum und Endplatzierung. Die Web-App liest nur noch die fertigen Werte.

**Architecture:** `tools/template.ts` erzeugt die Arbeitsmappe mit exceljs. Die Formeln werden in Tests mit HyperFormula (`tools/calc.ts`) durchgerechnet. `tools/demo.ts` erzeugt aus derselben Vorlage und Demo-Ergebnissen die CSVs in `public/demo/`. Die App (`src/data/parse.ts`) liest zusätzlich die Blätter `Gruppe A`, `Gruppe B` und `Endplatzierung`. Ihre eigene Wertungslogik (`standings.ts`, `bracket.ts`) wird gelöscht. Der Typ `Snapshot` und alle UI-Komponenten bleiben unverändert.

**Tech Stack:** TypeScript (Node 24 führt `.ts` direkt aus), exceljs 4, HyperFormula 3 (neu, nur Dev), Vitest, Svelte 5, papaparse.

**Spec:** `docs/superpowers/specs/2026-10-10-excel-rechnet-design.md` (dazu Abschnitt 2 von `docs/superpowers/specs/2026-10-10-stammtisch-turnier-design.md` für die Turnierregeln)

## Global Constraints

- Nur diese Funktionen sind in Formeln erlaubt: `IF`, `IFERROR`, `AND`, `OR`, `INDEX`, `MATCH`, `SUMPRODUCT`, `SUM`, `TEXT`, `TIMEVALUE`, `VALUE`. Kein `LET`, `SORT`, `FILTER`, `XLOOKUP`, `ROW` oder `COUNTIFS`.
- Formeln werden als `{ formula }` ohne `result` geschrieben (Helfer `fx`). Google Sheets und Excel rechnen beim Öffnen neu.
- Jedes Blatt, das die App liest, hat in Zeile 1 die Spaltenüberschriften.
- Blattnamen sind exakt: `Einstellungen`, `Teams`, `Spielplan`, `Gruppe A`, `Gruppe B`, `Turnierbaum`, `Endplatzierung`, `Spieler`.
- Spielplan-Spalten A–M: `Nr.`, `Phase`, `Zeit`, `Runde`, `Code A`, `Team A`, `Code B`, `Team B`, `Tore A`, `Tore B`, `Sieger`, `Sieger-Code`, `Verlierer-Code`.
- Gruppenblatt-Spalten A–N: `Platz`, `Code`, `Team`, `Sp`, `S`, `U`, `N`, `Tore`, `Gegentore`, `Diff`, `Pkt`, `Hinweis`, `KO-Code`, `Platzhalter`. Die App liest nur A1:L6.
- Platzhalter-Texte: `1. Gr. A` … `5. Gr. B`, `Sieger HF1`, `Sieger HF2`, `Verlierer HF1`, `Verlierer HF2`, Zusatz ` (Los ausstehend)`.
- HyperFormula wird immer mit `{ licenseKey: 'gpl-v3', useArrayArithmetic: true }` gebaut.
- Die UI-Texte und Kommentare sind deutsch. Code-Stil wie im Repo: kurze Funktionen, einzeilige Warum-Kommentare.
- Commits enden mit `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

- Die Gruppentabelle bei Gleichstand mehrerer Teams muss wie die bisherige App-Logik sortieren: Mini-Tabelle (Punkte, dann Tordifferenz) nur unter Teams mit gleichen Punkten und gleicher Tordifferenz, danach Tore, danach Los. Das testet Task 3, Szenario „Mini-Tabelle“.
- Ein voller Gleichstand ohne Los darf kein Team in die K.-o.-Runde setzen. Dort steht dann „x. Gr. Y (Los ausstehend)“. Das testet Task 3, Szenario „Los“.
- Leere Tor-Zellen dürfen weder als 0:0 noch als gespielt zählen. Das prüfen Task 3 („unvollständige Gruppe“) und Task 5 („halb eingetragenes Ergebnis“).
- Ein umbenanntes Team muss überall nachziehen: Spielplan, Tabelle, Turnierbaum, Endplatzierung. Das testet Task 6 im End-to-End-Test mit eigenen Teamnamen.
- Negative Tordifferenzen müssen in der App ankommen, denn der gviz-Export liefert „-3“. Das testet Task 5 mit der Gruppen-CSV.

---

### Task 1: HyperFormula-Rechner für Tests

**Files:**
- Create: `tools/calc.ts`
- Create: `tools/calc.test.ts`
- Modify: `package.json` (devDependency `hyperformula`)

**Interfaces:**
- Produces: `calculate(wb: ExcelJS.Workbook): Calc` mit `Calc.get(sheet: string, address: string): CellValue` und `Calc.table(sheet: string, range: string): CellValue[][]`, wobei `type CellValue = string | number | boolean | null`. Leere Zellen ergeben `null`, Formeln mit Ergebnis `""` ergeben `""`, Formelfehler werfen einen `Error` mit Blatt, Adresse und Meldung.

- [ ] **Step 1: Abhängigkeit installieren**

Run: `npm i -D hyperformula@3`
Expected: In `package.json` steht unter devDependencies `"hyperformula": "^3.x"`.

- [ ] **Step 2: Failing test schreiben** (`tools/calc.test.ts`)

```ts
import ExcelJS from 'exceljs';
import { describe, expect, it } from 'vitest';
import { calculate } from './calc.ts';

function book() {
  const wb = new ExcelJS.Workbook();
  const e = wb.addWorksheet('Einstellungen');
  e.getCell('A1').value = '14:00';
  e.getCell('A2').value = 'x';
  e.getCell('A3').value = 'y';
  const s = wb.addWorksheet('S');
  s.getCell('A1').value = { formula: 'TEXT(TIMEVALUE(Einstellungen!A1)+12/1440,"hh:mm")' } as ExcelJS.CellFormulaValue;
  s.getCell('B1').value = { formula: 'SUMPRODUCT((Einstellungen!A2:A3="x")*1)' } as ExcelJS.CellFormulaValue;
  s.getCell('C1').value = { formula: 'IF(1=1,"","nein")' } as ExcelJS.CellFormulaValue;
  s.getCell('A2').value = 7;
  return wb;
}

describe('calculate', () => {
  it('rechnet Formeln und behandelt Texte wie Google Sheets als Text', () => {
    const c = calculate(book());
    expect(c.get('S', 'A1')).toBe('14:12');
    expect(c.get('S', 'B1')).toBe(1);
    expect(c.get('S', 'C1')).toBe('');
    expect(c.get('S', 'D1')).toBeNull();
    expect(c.get('Einstellungen', 'A1')).toBe('14:00');
  });

  it('liest Bereiche zeilenweise', () => {
    expect(calculate(book()).table('S', 'A1:B2')).toEqual([['14:12', 1], [7, null]]);
  });

  it('meldet Formelfehler mit Adresse', () => {
    const wb = book();
    wb.getWorksheet('S')!.getCell('E1').value = { formula: 'VALUE("abc")' } as ExcelJS.CellFormulaValue;
    expect(() => calculate(wb).get('S', 'E1')).toThrow('S!E1');
  });
});
```

- [ ] **Step 3: Test laufen lassen, er muss fehlschlagen**

Run: `npx vitest run tools/calc.test.ts`
Expected: FAIL („Cannot find module './calc.ts'“ o. ä.)

- [ ] **Step 4: Implementieren** (`tools/calc.ts`)

```ts
// Nur für Tests und Demo-Daten: rechnet die Vorlage so durch, wie Google Sheets es beim Import tut.
import type ExcelJS from 'exceljs';
import { HyperFormula, type RawCellContent } from 'hyperformula';

export type CellValue = string | number | boolean | null;

export interface Calc {
  get(sheet: string, address: string): CellValue;
  table(sheet: string, range: string): CellValue[][];
}

function toRaw(v: ExcelJS.CellValue): RawCellContent {
  if (v === null || v === undefined) return null;
  if (typeof v === 'number' || typeof v === 'boolean') return v;
  // Apostroph: Text bleibt Text (wie Format „@“), sonst würde „14:00“ zur Uhrzeit-Zahl
  if (typeof v === 'string') return `'${v}`;
  if (typeof v === 'object' && 'formula' in v) return `=${v.formula}`;
  throw new Error(`Zellwert nicht unterstützt: ${JSON.stringify(v)}`);
}

export function calculate(wb: ExcelJS.Workbook): Calc {
  const sheets: Record<string, RawCellContent[][]> = {};
  for (const ws of wb.worksheets) {
    const rows: RawCellContent[][] = [];
    ws.eachRow({ includeEmpty: true }, (row, r) => {
      const cells: RawCellContent[] = [];
      row.eachCell({ includeEmpty: true }, (cell, c) => (cells[c - 1] = toRaw(cell.value)));
      rows[r - 1] = Array.from(cells, (v) => v ?? null);
    });
    sheets[ws.name] = Array.from(rows, (r) => r ?? []);
  }
  const hf = HyperFormula.buildFromSheets(sheets, { licenseKey: 'gpl-v3', useArrayArithmetic: true });
  const id = (sheet: string) => {
    const i = hf.getSheetId(sheet);
    if (i === undefined) throw new Error(`Blatt „${sheet}“ fehlt`);
    return i;
  };
  const check = (v: unknown, where: string): CellValue => {
    if (v !== null && typeof v === 'object') {
      const e = v as { value: string; message: string };
      throw new Error(`${where}: ${e.value} ${e.message}`);
    }
    return v as CellValue;
  };
  return {
    get: (sheet, address) => check(hf.getCellValue(hf.simpleCellAddressFromString(address, id(sheet))!), `${sheet}!${address}`),
    table: (sheet, range) =>
      hf.getRangeValues(hf.simpleCellRangeFromString(range, id(sheet))!).map((row) => row.map((v) => check(v, `${sheet}!${range}`))),
  };
}
```

- [ ] **Step 5: Test laufen lassen, er muss grün sein**

Run: `npx vitest run tools/calc.test.ts`
Expected: PASS (3 Tests)

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json tools/calc.ts tools/calc.test.ts
git commit -m "test: HyperFormula-Rechner für die Excel-Vorlage"
```

---

### Task 2: Spielplan-Generator mit Phase und K.-o.-Seiten

**Files:**
- Modify: `tools/schedule-gen.ts` (komplett ersetzen)
- Modify: `tools/schedule-gen.test.ts`

**Interfaces:**
- Produces:
  - `type Group = 'A' | 'B'`
  - `type Slot = { group: Group; i: number }` (i = 0–4)
  - `type GroupPlace = { group: Group; place: number }` (1–5)
  - `type SemiResult = { result: 'Sieger' | 'Verlierer'; semi: 1 | 2 }`
  - `type PlanSide = Slot | GroupPlace | SemiResult`
  - `interface PlanRow { nr: number; phase: string; round: string; home: PlanSide; away: PlanSide }`
  - `GROUP_ORDER` (unverändert), `planRows(): PlanRow[]`
  - `sideLabel(s: PlanSide): string`, das `A1` bzw. `3. Gr. B` bzw. `Sieger HF1` liefert

- [ ] **Step 1: Test anpassen** (`tools/schedule-gen.test.ts`): Import und die letzten zwei Tests ersetzen, die übrigen bleiben.

```ts
import { describe, expect, it } from 'vitest';
import { GROUP_ORDER, planRows, sideLabel, type Slot } from './schedule-gen.ts';
```

Den Test „verwendet in den Gruppenspielen Slots der richtigen Gruppe“ ersetzen durch:

```ts
  it('verwendet in den Gruppenspielen Slots der richtigen Gruppe', () => {
    for (const r of rows.slice(0, 20)) {
      const g = r.round.endsWith('A') ? 'A' : 'B';
      expect((r.home as Slot).group).toBe(g);
      expect((r.away as Slot).group).toBe(g);
      expect(r.phase).toBe('Gruppenphase');
    }
  });
```

Den Test „hat die Finalrunde laut Spec“ ersetzen durch:

```ts
  it('hat die Finalrunde laut Spec', () => {
    expect(rows.slice(20).map((r) => [r.nr, r.phase, r.round, sideLabel(r.home), sideLabel(r.away)])).toEqual([
      [21, 'Platzierungsspiel', 'Spiel um Platz 9', '5. Gr. A', '5. Gr. B'],
      [22, 'Halbfinale', 'Halbfinale 1', '1. Gr. A', '2. Gr. B'],
      [23, 'Platzierungsspiel', 'Spiel um Platz 7', '4. Gr. A', '4. Gr. B'],
      [24, 'Halbfinale', 'Halbfinale 2', '2. Gr. A', '1. Gr. B'],
      [25, 'Platzierungsspiel', 'Spiel um Platz 5', '3. Gr. A', '3. Gr. B'],
      [26, 'Platzierungsspiel', 'Spiel um Platz 3', 'Verlierer HF1', 'Verlierer HF2'],
      [27, 'Finale', 'Finale', 'Sieger HF1', 'Sieger HF2'],
    ]);
  });

  it('beschriftet Gruppen-Slots mit dem Teamcode', () => {
    expect(sideLabel({ group: 'B', i: 2 })).toBe('B3');
  });
```

- [ ] **Step 2: Test laufen lassen, er muss fehlschlagen**

Run: `npx vitest run tools/schedule-gen.test.ts`
Expected: FAIL („sideLabel is not a function“ bzw. falsche Werte)

- [ ] **Step 3: Implementieren** (`tools/schedule-gen.ts`, komplett ersetzen)

```ts
export type Group = 'A' | 'B';
/** Team aus Blatt Teams, i = Index 0–4 in der Gruppe */
export type Slot = { group: Group; i: number };
/** Platz 1–5 der Gruppen-Endtabelle */
export type GroupPlace = { group: Group; place: number };
export type SemiResult = { result: 'Sieger' | 'Verlierer'; semi: 1 | 2 };
export type PlanSide = Slot | GroupPlace | SemiResult;

export interface PlanRow {
  nr: number;
  phase: string;
  round: string;
  home: PlanSide;
  away: PlanSide;
}

/** Reihenfolge in einer 5er-Gruppe: jedes Paar genau einmal, aufeinanderfolgende Spiele ohne gemeinsames Team. */
export const GROUP_ORDER: [number, number][] = [
  [0, 1], [2, 3], [0, 4], [1, 2], [3, 4],
  [0, 2], [1, 3], [2, 4], [0, 3], [1, 4],
];

const gp = (group: Group, place: number): GroupPlace => ({ group, place });

export const KNOCKOUT: [phase: string, round: string, home: PlanSide, away: PlanSide][] = [
  ['Platzierungsspiel', 'Spiel um Platz 9', gp('A', 5), gp('B', 5)],
  ['Halbfinale', 'Halbfinale 1', gp('A', 1), gp('B', 2)],
  ['Platzierungsspiel', 'Spiel um Platz 7', gp('A', 4), gp('B', 4)],
  ['Halbfinale', 'Halbfinale 2', gp('A', 2), gp('B', 1)],
  ['Platzierungsspiel', 'Spiel um Platz 5', gp('A', 3), gp('B', 3)],
  ['Platzierungsspiel', 'Spiel um Platz 3', { result: 'Verlierer', semi: 1 }, { result: 'Verlierer', semi: 2 }],
  ['Finale', 'Finale', { result: 'Sieger', semi: 1 }, { result: 'Sieger', semi: 2 }],
];

export const sideLabel = (s: PlanSide): string =>
  'i' in s ? `${s.group}${s.i + 1}` : 'place' in s ? `${s.place}. Gr. ${s.group}` : `${s.result} HF${s.semi}`;

export function planRows(): PlanRow[] {
  const rows: PlanRow[] = [];
  for (const [h, a] of GROUP_ORDER) {
    for (const group of ['A', 'B'] as const) {
      rows.push({ nr: rows.length + 1, phase: 'Gruppenphase', round: `Gruppe ${group}`, home: { group, i: h }, away: { group, i: a } });
    }
  }
  for (const [phase, round, home, away] of KNOCKOUT) rows.push({ nr: rows.length + 1, phase, round, home, away });
  return rows;
}
```

- [ ] **Step 4: Test laufen lassen, er muss grün sein**

Run: `npx vitest run tools/schedule-gen.test.ts`
Expected: PASS. Hinweis: `tools/template.test.ts` und `src/domain/snapshot.test.ts` können jetzt rot sein. Das ist erwartet und wird in Task 3 bzw. Task 5 behoben.

- [ ] **Step 5: Commit**

```bash
git add tools/schedule-gen.ts tools/schedule-gen.test.ts
git commit -m "feat: Spielplan-Generator mit Phase und Platzhaltern „1. Gr. A“"
```

---

### Task 3: Vorlage – Teams, Spielplan und Gruppentabellen mit Formeln

**Files:**
- Modify: `tools/template.ts` (komplett ersetzen)
- Modify: `tools/template.test.ts` (komplett ersetzen)

**Interfaces:**
- Consumes: `planRows`, `sideLabel`, `PlanSide`, `Group` (Task 2), `calculate` (Task 1)
- Produces:
  - `buildWorkbook(): ExcelJS.Workbook` mit den Blättern `Einstellungen`, `Teams`, `Spielplan`, `Gruppe A`, `Gruppe B`, `Spieler` (Task 4 fügt `Turnierbaum` und `Endplatzierung` vor `Spieler` ein)
  - `PLAN_ROW(round: string): number`: die Spielplan-Zeile einer Runde
  - `teamRow(group: Group, i: number): number`
  - Exportierte Konstanten `fx`, `nameOf`, `CODES` und die Funktion `sheet` für Task 4

- [ ] **Step 1: Failing tests schreiben** (`tools/template.test.ts`, komplett ersetzen)

```ts
import type ExcelJS from 'exceljs';
import { describe, expect, it } from 'vitest';
import { calculate } from './calc.ts';
import { planRows, sideLabel } from './schedule-gen.ts';
import { buildWorkbook, PLAN_ROW } from './template.ts';

/** Ergebnis eines Gruppenspiels aus Sicht von Code a eintragen (Heim/Gast egal) */
function score(wb: ExcelJS.Workbook, a: string, b: string, ga: number, gb: number) {
  const k = planRows().findIndex(
    (x) => x.nr <= 20 && [sideLabel(x.home), sideLabel(x.away)].sort().join() === [a, b].sort().join(),
  );
  if (k === -1) throw new Error(`kein Spiel ${a}–${b}`);
  const flip = sideLabel(planRows()[k].home) === b;
  const plan = wb.getWorksheet('Spielplan')!;
  plan.getCell(`I${k + 2}`).value = flip ? gb : ga;
  plan.getCell(`J${k + 2}`).value = flip ? ga : gb;
}

/** Jede Gruppe nach Stärke: kleinerer Code gewinnt 2:0 */
function playGroupsByStrength(wb: ExcelJS.Workbook) {
  for (const g of ['A', 'B'])
    for (let i = 1; i <= 5; i++) for (let j = i + 1; j <= 5; j++) score(wb, `${g}${i}`, `${g}${j}`, 2, 0);
}

/** Alle K.-o.-Spiele 1:0 für Team A */
function playKnockoutHomeWins(wb: ExcelJS.Workbook) {
  const plan = wb.getWorksheet('Spielplan')!;
  for (let r = 22; r <= 28; r++) {
    plan.getCell(`I${r}`).value = 1;
    plan.getCell(`J${r}`).value = 0;
  }
}

const col = (rows: unknown[][], i: number) => rows.map((r) => r[i]);

describe('buildWorkbook – Aufbau', () => {
  const wb = buildWorkbook();

  it('hat die Blätter in fester Reihenfolge', () => {
    expect(wb.worksheets.map((w) => w.name)).toEqual(['Einstellungen', 'Teams', 'Spielplan', 'Gruppe A', 'Gruppe B', 'Spieler']);
  });

  it('hat Teams mit festen Codes', () => {
    const t = wb.getWorksheet('Teams')!;
    expect(t.getRow(1).values).toEqual([undefined, 'Code', 'Team', 'Gruppe', 'Los']);
    expect(t.getCell('A7').value).toBe('B1');
    expect(t.getCell('B7').value).toBe('Team B1');
    expect(t.getCell('C7').value).toBe('B');
  });

  it('hat die Spielplan-Spalten laut Spec und 27 Spiele', () => {
    const plan = wb.getWorksheet('Spielplan')!;
    expect(plan.getRow(1).values).toEqual([
      undefined, 'Nr.', 'Phase', 'Zeit', 'Runde', 'Code A', 'Team A', 'Code B', 'Team B', 'Tore A', 'Tore B', 'Sieger', 'Sieger-Code', 'Verlierer-Code',
    ]);
    expect(plan.rowCount).toBe(28);
    expect(plan.getColumn(12).hidden).toBe(true);
    expect(PLAN_ROW('Finale')).toBe(28);
  });

  it('formatiert alle Einstellungen als Text, damit gviz keine Werte verwirft', () => {
    const s = wb.getWorksheet('Einstellungen')!;
    for (let r = 2; r <= 6; r++) {
      expect(typeof s.getCell(r, 2).value).toBe('string');
      expect(s.getCell(r, 2).numFmt).toBe('@');
    }
  });

  it('lässt sich als xlsx schreiben', async () => {
    expect((await wb.xlsx.writeBuffer()).byteLength).toBeGreaterThan(1000);
  });
});

describe('buildWorkbook – Formeln', () => {
  it('berechnet Zeit, Teamnamen und Sieger im Spielplan', () => {
    const wb = buildWorkbook();
    score(wb, 'A1', 'A2', 2, 2);
    score(wb, 'B1', 'B2', 3, 1);
    const c = calculate(wb);
    expect([c.get('Spielplan', 'C2'), c.get('Spielplan', 'C3'), c.get('Spielplan', 'C28')]).toEqual(['14:00', '14:12', '19:12']);
    expect([c.get('Spielplan', 'E2'), c.get('Spielplan', 'F2'), c.get('Spielplan', 'H2')]).toEqual(['A1', 'Team A1', 'Team A2']);
    expect(c.get('Spielplan', 'K2')).toBe('Unentschieden');
    expect(c.get('Spielplan', 'K3')).toBe('Team B1');
    expect([c.get('Spielplan', 'L3'), c.get('Spielplan', 'M3')]).toEqual(['B1', 'B2']);
    expect(c.get('Spielplan', 'K4')).toBe('');
  });

  it('zeigt Platzhalter, solange die Gruppe nicht komplett ist', () => {
    const wb = buildWorkbook();
    score(wb, 'A1', 'A2', 1, 0);
    const c = calculate(wb);
    expect([c.get('Spielplan', 'E23'), c.get('Spielplan', 'F23'), c.get('Spielplan', 'H23')]).toEqual(['', '1. Gr. A', '2. Gr. B']);
    expect(c.get('Spielplan', 'F28')).toBe('Sieger HF1');
    expect(c.get('Gruppe A', 'L2')).toBe('');
    expect(c.get('Gruppe A', 'D2')).toBe(1);
  });

  it('rechnet Tabellen und K.-o.-Runde bis zum Finale durch', () => {
    const wb = buildWorkbook();
    playGroupsByStrength(wb);
    let c = calculate(wb);
    const a = c.table('Gruppe A', 'A2:L6');
    expect(col(a, 0)).toEqual([1, 2, 3, 4, 5]);
    expect(col(a, 1)).toEqual(['A1', 'A2', 'A3', 'A4', 'A5']);
    expect(a[0]).toEqual([1, 'A1', 'Team A1', 4, 4, 0, 0, 8, 0, 8, 12, '']);
    expect(a[4].slice(7, 11)).toEqual([0, 8, -8, 0]);
    expect([c.get('Spielplan', 'E23'), c.get('Spielplan', 'F23'), c.get('Spielplan', 'H23')]).toEqual(['A1', 'Team A1', 'Team B2']);
    playKnockoutHomeWins(wb);
    c = calculate(wb);
    expect([c.get('Spielplan', 'F28'), c.get('Spielplan', 'H28'), c.get('Spielplan', 'K28')]).toEqual(['Team A1', 'Team A2', 'Team A1']);
    expect([c.get('Spielplan', 'F27'), c.get('Spielplan', 'H27')]).toEqual(['Team B2', 'Team B1']);
  });

  it('sortiert drei gleichstehende Teams über die Mini-Tabelle', () => {
    // A1, A2, A3: je 7 Punkte und +1. Mini-Tabelle: A1 6 Pkt, A2/A3 je 1 Pkt und −1 → mehr Tore: A3 (4) vor A2 (3).
    // Nur nach Toren sortiert wäre die Reihenfolge A3, A2, A1 – der Test erkennt also eine fehlende Mini-Tabelle.
    const wb = buildWorkbook();
    const games: [string, string, number, number][] = [
      ['A1', 'A2', 1, 0], ['A1', 'A3', 1, 0], ['A2', 'A3', 1, 1], ['A1', 'A4', 0, 0], ['A1', 'A5', 0, 1],
      ['A2', 'A4', 1, 0], ['A2', 'A5', 1, 0], ['A3', 'A4', 2, 1], ['A3', 'A5', 1, 0], ['A4', 'A5', 0, 0],
    ];
    for (const [x, y, gx, gy] of games) score(wb, x, y, gx, gy);
    const c = calculate(wb);
    expect(col(c.table('Gruppe A', 'A2:L6'), 1)).toEqual(['A1', 'A3', 'A2', 'A5', 'A4']);
    expect(col(c.table('Gruppe A', 'A2:L6'), 11)).toEqual(['', '', '', '', '']);
  });

  it('meldet „Los ausstehend“ und löst mit Los auf', () => {
    const wb = buildWorkbook();
    playGroupsByStrength(wb);
    for (let i = 1; i <= 5; i++) for (let j = i + 1; j <= 5; j++) score(wb, `B${i}`, `B${j}`, 0, 0);
    let c = calculate(wb);
    expect(col(c.table('Gruppe B', 'A2:L6'), 11)).toEqual(Array(5).fill('Los ausstehend'));
    expect([c.get('Spielplan', 'G23'), c.get('Spielplan', 'H23')]).toEqual(['', '2. Gr. B (Los ausstehend)']);
    expect(c.get('Spielplan', 'E23')).toBe('A1');

    const teams = wb.getWorksheet('Teams')!;
    [5, 4, 3, 2, 1].forEach((lot, k) => (teams.getCell(`D${7 + k}`).value = lot));
    c = calculate(wb);
    expect(col(c.table('Gruppe B', 'A2:L6'), 1)).toEqual(['B5', 'B4', 'B3', 'B2', 'B1']);
    expect(col(c.table('Gruppe B', 'A2:L6'), 11)).toEqual(['', '', '', '', '']);
    expect([c.get('Spielplan', 'G23'), c.get('Spielplan', 'H23')]).toEqual(['B4', 'Team B4']);
  });
});
```

- [ ] **Step 2: Tests laufen lassen, sie müssen fehlschlagen**

Run: `npx vitest run tools/template.test.ts`
Expected: FAIL (`PLAN_ROW` existiert nicht, Blätter fehlen)

- [ ] **Step 3: Implementieren** (`tools/template.ts`, komplett ersetzen)

```ts
import { mkdirSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import ExcelJS from 'exceljs';
import { planRows, sideLabel, type Group, type PlanSide } from './schedule-gen.ts';

/** Zeile im Blatt Teams: A1–A5 in Zeile 2–6, B1–B5 in Zeile 7–11 */
export const teamRow = (group: Group, i: number): number => 2 + (group === 'B' ? 5 : 0) + i;

const ROWS = planRows();
/** Spielplan-Zeile einer Runde, z. B. „Halbfinale 1“ → 23 */
export const PLAN_ROW = (round: string): number => 2 + ROWS.findIndex((x) => x.round === round);

export const fx = (formula: string) => ({ formula }) as ExcelJS.CellFormulaValue;
export const CODES = 'Teams!$A$2:$A$11';
export const nameOf = (code: string) => `IFERROR(INDEX(Teams!$B$2:$B$11,MATCH(${code},${CODES},0)),"")`;

// Gruppenspiele stehen im Spielplan in Zeile 2–21
const P = {
  round: 'Spielplan!$D$2:$D$21', codeA: 'Spielplan!$E$2:$E$21', codeB: 'Spielplan!$G$2:$G$21',
  goalsA: 'Spielplan!$I$2:$I$21', goalsB: 'Spielplan!$J$2:$J$21',
};
const DONE = `(${P.goalsA}<>"")*(${P.goalsB}<>"")`;
const INPUT: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF2CC' } };
const CALC: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEDEDED' } };

export function sheet(wb: ExcelJS.Workbook, name: string, columns: [string, number][]): ExcelJS.Worksheet {
  const ws = wb.addWorksheet(name, { views: [{ state: 'frozen', ySplit: 1 }] });
  ws.columns = columns.map(([header, width]) => ({ header, width }));
  ws.getRow(1).font = { bold: true };
  return ws;
}

/** [Code-Zelle, Platzhalter-Ausdruck oder null bei festem Team] */
function side(s: PlanSide): [string | ExcelJS.CellFormulaValue, string | null] {
  if ('i' in s) return [sideLabel(s), null];
  if ('place' in s) return [fx(`'Gruppe ${s.group}'!$M$${s.place + 1}`), `'Gruppe ${s.group}'!$N$${s.place + 1}`];
  return [fx(`$${s.result === 'Sieger' ? 'L' : 'M'}$${PLAN_ROW(`Halbfinale ${s.semi}`)}`), `"${sideLabel(s)}"`];
}

function planSheet(wb: ExcelJS.Workbook) {
  const plan = sheet(wb, 'Spielplan', [
    ['Nr.', 5], ['Phase', 16], ['Zeit', 7], ['Runde', 18], ['Code A', 8], ['Team A', 26], ['Code B', 8], ['Team B', 26],
    ['Tore A', 7], ['Tore B', 7], ['Sieger', 26], ['Sieger-Code', 11], ['Verlierer-Code', 13],
  ]);
  for (const [k, x] of ROWS.entries()) {
    const r = k + 2;
    const team = (codeCol: string, label: string | null) =>
      fx(label === null ? nameOf(`${codeCol}${r}`) : `IF(${codeCol}${r}="",${label},${nameOf(`${codeCol}${r}`)})`);
    const [codeA, labelA] = side(x.home);
    const [codeB, labelB] = side(x.away);
    const open = `OR(I${r}="",J${r}="")`;
    const row = plan.addRow([
      x.nr, x.phase,
      fx(`TEXT(TIMEVALUE(Einstellungen!$B$4)+(A${r}-1)*(VALUE(Einstellungen!$B$5)+VALUE(Einstellungen!$B$6))/1440,"hh:mm")`),
      x.round, codeA, team('E', labelA), codeB, team('G', labelB), null, null,
      fx(`IF(${open},"",IF(I${r}>J${r},F${r},IF(J${r}>I${r},H${r},"Unentschieden")))`),
      fx(`IF(${open},"",IF(I${r}>J${r},E${r},IF(J${r}>I${r},G${r},"")))`),
      fx(`IF(${open},"",IF(I${r}>J${r},G${r},IF(J${r}>I${r},E${r},"")))`),
    ]);
    row.getCell(9).fill = INPUT;
    row.getCell(10).fill = INPUT;
  }
  plan.getColumn(12).hidden = true;
  plan.getColumn(13).hidden = true;
}

const CALC_COLS = [
  'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z', 'AA',
];

function groupSheet(wb: ExcelJS.Workbook, g: Group) {
  const ws = sheet(wb, `Gruppe ${g}`, [
    ['Platz', 6], ['Code', 6], ['Team', 24], ['Sp', 5], ['S', 5], ['U', 5], ['N', 5], ['Tore', 6], ['Gegentore', 10],
    ['Diff', 6], ['Pkt', 6], ['Hinweis', 16], ['KO-Code', 9], ['Platzhalter', 26],
  ]);
  // Rechenhilfe: eine Zeile pro Team X1–X5 in Zeile 10–14
  const first = 10;
  const codes = [1, 2, 3, 4, 5].map((n) => `${g}${n}`);
  const all = (c: string) => `$${c}$${first}:$${c}$${first + 4}`;
  ws.getCell('A8').value = 'Rechenhilfe – nicht bearbeiten';
  ws.getCell('A8').font = { bold: true };
  ws.getRow(9).values = [
    'Code', 'Team', 'Sp', 'S', 'U', 'N', 'Tore', 'Gegentore', 'Diff', 'Pkt',
    ...codes.map((c) => `Mini-Pkt ${c}`), ...codes.map((c) => `Mini-Diff ${c}`),
    'Mini-Pkt', 'Mini-Diff', 'Los', 'Schlüssel', 'Rang', 'Los offen', 'Anzeigeplatz',
  ];
  for (const [k, code] of codes.entries()) {
    const r = first + k;
    const me = `$A${r}`;
    const home = `(${P.codeA}=${me})`;
    const away = `(${P.codeB}=${me})`;
    // Mini-Tabelle: nur Spiele gegen Teams mit gleichen Punkten und gleicher Tordifferenz zählen
    const vs = (j: number, pts: boolean) => {
      const opp = `$A$${first + j}`;
      const tie = `($J$${first + j}=$J${r})*($I$${first + j}=$I${r})`;
      const v = pts
        ? `SUMPRODUCT(${home}*(${P.codeB}=${opp})*${DONE}*(3*(${P.goalsA}>${P.goalsB})+(${P.goalsA}=${P.goalsB})))` +
          `+SUMPRODUCT(${away}*(${P.codeA}=${opp})*${DONE}*(3*(${P.goalsB}>${P.goalsA})+(${P.goalsA}=${P.goalsB})))`
        : `SUMPRODUCT(${home}*(${P.codeB}=${opp})*(${P.goalsA}-${P.goalsB}))+SUMPRODUCT(${away}*(${P.codeA}=${opp})*(${P.goalsB}-${P.goalsA}))`;
      return fx(`(${v})*${tie}`);
    };
    const lot = `INDEX(Teams!$D$2:$D$11,MATCH(${me},${CODES},0))`;
    ws.getRow(r).values = [
      code,
      fx(nameOf(me)),
      fx(`SUMPRODUCT((${home}+${away})*${DONE})`),
      fx(`SUMPRODUCT(${home}*${DONE}*(${P.goalsA}>${P.goalsB}))+SUMPRODUCT(${away}*${DONE}*(${P.goalsB}>${P.goalsA}))`),
      fx(`SUMPRODUCT((${home}+${away})*${DONE}*(${P.goalsA}=${P.goalsB}))`),
      fx(`C${r}-D${r}-E${r}`),
      fx(`SUMPRODUCT(${home}*${P.goalsA})+SUMPRODUCT(${away}*${P.goalsB})`),
      fx(`SUMPRODUCT(${home}*${P.goalsB})+SUMPRODUCT(${away}*${P.goalsA})`),
      fx(`G${r}-H${r}`),
      fx(`3*D${r}+E${r}`),
      ...[0, 1, 2, 3, 4].map((j) => vs(j, true)),
      ...[0, 1, 2, 3, 4].map((j) => vs(j, false)),
      fx(`SUM(K${r}:O${r})`),
      fx(`SUM(P${r}:T${r})`),
      fx(`IF(${lot}="","",${lot})`),
      // Punkte, Diff, Mini-Pkt, Mini-Diff, Tore als eine Zahl (< 15 Stellen, also exakt)
      fx(`J${r}*10^11+(I${r}+500)*10^8+U${r}*10^6+(V${r}+500)*10^3+G${r}`),
      fx(`1+SUMPRODUCT(--(${all('X')}>X${r}))+SUMPRODUCT((${all('X')}=X${r})*(${all('W')}<>"")*(W${r}<>"")*(${all('W')}<W${r}))`),
      fx(`IF(SUMPRODUCT((${all('X')}=X${r})*(${all('A')}<>A${r})*(((${all('W')}="")+(W${r}="")+(${all('W')}=W${r}))>0))>0,1,0)`),
      fx(`Y${r}+SUMPRODUCT((${all('Y')}=Y${r})*(${all('A')}<A${r}))`),
    ];
    for (const c of CALC_COLS) ws.getCell(`${c}${r}`).fill = CALC;
  }
  ws.getCell('A16').value = 'Gruppe komplett';
  ws.getCell('B16').value = fx(`IF(SUMPRODUCT((${P.round}="Gruppe ${g}")*${DONE})=10,1,0)`);

  // Anzeige: Platz p holt die Zeile mit Anzeigeplatz p
  for (let p = 1; p <= 5; p++) {
    const row = p + 1;
    const at = (c: string) => fx(`INDEX(${all(c)},MATCH($A${row},${all('AA')},0))`);
    ws.getRow(row).values = [
      p, at('A'), at('B'), at('C'), at('D'), at('E'), at('F'), at('G'), at('H'), at('I'), at('J'),
      fx(`IF(AND($B$16=1,INDEX(${all('Z')},MATCH($A${row},${all('AA')},0))=1),"Los ausstehend","")`),
      fx(`IF(AND($B$16=1,L${row}=""),B${row},"")`),
      fx(`A${row}&". Gr. ${g}"&IF(L${row}<>""," (Los ausstehend)","")`),
    ];
  }
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
  settings.getColumn(2).eachCell((c) => (c.numFmt = '@'));

  const teams = sheet(wb, 'Teams', [['Code', 6], ['Team', 24], ['Gruppe', 8], ['Los', 6]]);
  for (const g of ['A', 'B'] as const)
    for (let i = 1; i <= 5; i++) {
      const row = teams.addRow([`${g}${i}`, `Team ${g}${i}`, g, null]);
      row.getCell(2).fill = INPUT;
      row.getCell(4).fill = INPUT;
    }

  planSheet(wb);
  groupSheet(wb, 'A');
  groupSheet(wb, 'B');

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

Hinweis zur Einstellungen-Spalte: In der alten Version stand `settings.getColumn(2).numFmt = '@'` zusätzlich vor `eachCell`. Das `eachCell` setzt das Format pro Zelle, und genau das prüft der Test. Die Zeile davor ist überflüssig und entfällt.

- [ ] **Step 4: Tests laufen lassen, sie müssen grün sein**

Run: `npx vitest run tools/template.test.ts tools/calc.test.ts tools/schedule-gen.test.ts`
Expected: PASS. Wirft `calculate` einen Formelfehler, steht die Zelladresse in der Meldung. Dann diese Formel prüfen und nicht den Test ändern.

- [ ] **Step 5: Commit**

```bash
git add tools/template.ts tools/template.test.ts
git commit -m "feat: Vorlage rechnet Gruppentabellen und K.-o.-Paarungen per Formel"
```

---

### Task 4: Vorlage – Turnierbaum und Endplatzierung

**Files:**
- Modify: `tools/template.ts`
- Modify: `tools/template.test.ts`

**Interfaces:**
- Consumes: `PLAN_ROW`, `fx`, `nameOf`, `CODES`, `sheet` (Task 3)
- Produces: Blatt `Turnierbaum` und Blatt `Endplatzierung` (A1:D11: Platz | Team | Gruppe | Herkunft). Blattreihenfolge danach: `Einstellungen`, `Teams`, `Spielplan`, `Gruppe A`, `Gruppe B`, `Turnierbaum`, `Endplatzierung`, `Spieler`.

- [ ] **Step 1: Failing tests ergänzen** (`tools/template.test.ts`)

Im Test „hat die Blätter in fester Reihenfolge“ die erwartete Liste ersetzen durch:

```ts
    expect(wb.worksheets.map((w) => w.name)).toEqual([
      'Einstellungen', 'Teams', 'Spielplan', 'Gruppe A', 'Gruppe B', 'Turnierbaum', 'Endplatzierung', 'Spieler',
    ]);
```

Im `describe('buildWorkbook – Formeln')` ergänzen:

```ts
  it('füllt Endplatzierung und Turnierbaum aus dem Spielplan', () => {
    const wb = buildWorkbook();
    let c = calculate(wb);
    expect(c.get('Endplatzierung', 'B2')).toBe('');
    expect(c.get('Turnierbaum', 'B4')).toBe('1. Gr. A');

    playGroupsByStrength(wb);
    playKnockoutHomeWins(wb);
    c = calculate(wb);
    const end = c.table('Endplatzierung', 'A2:D11');
    expect(col(end, 0)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(col(end, 1)).toEqual([
      'Team A1', 'Team A2', 'Team B2', 'Team B1', 'Team A3', 'Team B3', 'Team A4', 'Team B4', 'Team A5', 'Team B5',
    ]);
    expect(end[0]).toEqual([1, 'Team A1', 'A', 'Sieger Finale']);
    expect(end[3][3]).toBe('Verlierer Spiel um Platz 3');
    expect([c.get('Turnierbaum', 'B4'), c.get('Turnierbaum', 'C4'), c.get('Turnierbaum', 'B5'), c.get('Turnierbaum', 'C5')])
      .toEqual(['Team A1', 1, 'Team B2', 0]);
    expect(c.get('Turnierbaum', 'E5')).toBe('Team A1');
  });
```

- [ ] **Step 2: Tests laufen lassen, sie müssen fehlschlagen**

Run: `npx vitest run tools/template.test.ts`
Expected: FAIL (Blätter `Turnierbaum`/`Endplatzierung` fehlen)

- [ ] **Step 3: Implementieren** (`tools/template.ts`)

Unterhalb von `groupSheet` einfügen:

```ts
/** [Runde, Spalte Teamname, Startzeile] – Spalte daneben zeigt die Tore */
const TREE: [round: string, col: 'B' | 'E', row: number][] = [
  ['Halbfinale 1', 'B', 3], ['Halbfinale 2', 'B', 7], ['Finale', 'E', 4], ['Spiel um Platz 3', 'E', 8],
  ['Spiel um Platz 5', 'B', 13], ['Spiel um Platz 7', 'B', 17], ['Spiel um Platz 9', 'B', 21],
];

function treeSheet(wb: ExcelJS.Workbook) {
  const ws = wb.addWorksheet('Turnierbaum');
  ws.columns = [3, 26, 6, 3, 26, 6].map((width) => ({ width }));
  ws.getCell('A1').value = 'Turnierbaum – füllt sich automatisch aus dem Spielplan';
  ws.getCell('B12').value = 'Platzierungsspiele';
  for (const c of ['A1', 'B12']) ws.getCell(c).font = { bold: true };
  for (const [round, col, row] of TREE) {
    const r = PLAN_ROW(round);
    const goals = col === 'B' ? 'C' : 'F';
    ws.getCell(`${col}${row}`).value = round;
    ws.getCell(`${col}${row}`).font = { bold: true };
    ws.getCell(`${col}${row + 1}`).value = fx(`Spielplan!F${r}`);
    ws.getCell(`${goals}${row + 1}`).value = fx(`IF(Spielplan!I${r}="","",Spielplan!I${r})`);
    ws.getCell(`${col}${row + 2}`).value = fx(`Spielplan!H${r}`);
    ws.getCell(`${goals}${row + 2}`).value = fx(`IF(Spielplan!J${r}="","",Spielplan!J${r})`);
  }
}

/** Spiel → Platz des Siegers (Verlierer = Platz + 1) */
const PLACES: [round: string, place: number][] = [
  ['Finale', 1], ['Spiel um Platz 3', 3], ['Spiel um Platz 5', 5], ['Spiel um Platz 7', 7], ['Spiel um Platz 9', 9],
];

function rankingSheet(wb: ExcelJS.Workbook) {
  const ws = sheet(wb, 'Endplatzierung', [['Platz', 6], ['Team', 26], ['Gruppe', 8], ['Herkunft', 28]]);
  for (const [round, place] of PLACES)
    for (const [k, who, col] of [[0, 'Sieger', 'L'], [1, 'Verlierer', 'M']] as const) {
      const code = `Spielplan!$${col}$${PLAN_ROW(round)}`;
      ws.getRow(place + k + 1).values = [
        place + k, fx(nameOf(code)), fx(`IFERROR(INDEX(Teams!$C$2:$C$11,MATCH(${code},${CODES},0)),"")`), `${who} ${round}`,
      ];
    }
}
```

In `buildWorkbook` nach `groupSheet(wb, 'B');` ergänzen:

```ts
  treeSheet(wb);
  rankingSheet(wb);
```

- [ ] **Step 4: Tests laufen lassen, sie müssen grün sein**

Run: `npx vitest run tools/`
Expected: PASS

- [ ] **Step 5: Vorlage neu erzeugen und committen**

Run: `npm run template`
Expected: „vorlage/stammtisch-turnier.xlsx geschrieben“

```bash
git add tools/template.ts tools/template.test.ts vorlage/stammtisch-turnier.xlsx
git commit -m "feat: Turnierbaum und Endplatzierung in der Vorlage"
```

---

### Task 5: Web-App liest fertige Werte statt selbst zu rechnen

**Files:**
- Modify: `src/domain/types.ts` (`Team`, `TournamentData`)
- Modify: `src/data/parse.ts` (komplett ersetzen)
- Modify: `src/data/parse.test.ts`
- Modify: `src/data/sheets.ts`, `src/data/sheets.test.ts`
- Modify: `src/domain/snapshot.ts` (komplett ersetzen), `src/domain/snapshot.test.ts` (komplett ersetzen)
- Modify: `src/domain/fixtures.ts`
- Delete: `src/domain/standings.ts`, `src/domain/standings.test.ts`, `src/domain/bracket.ts`, `src/domain/bracket.test.ts`

**Interfaces:**
- Produces:
  - `SHEET_NAMES = ['Einstellungen', 'Teams', 'Spielplan', 'Spieler', 'Gruppe A', 'Gruppe B', 'Endplatzierung']`
  - `SHEET_RANGES: Partial<Record<SheetName, string>>` mit Gruppe A/B `A1:L6`, Endplatzierung `A1:D11`
  - `TournamentData = { settings; teams: Team[]; matches: ResolvedMatch[]; players: Player[]; tables: GroupTable[]; ranking: (string | null)[] }`
  - `Team = { name: string; group: Group }`
  - `buildSnapshot(data, parseWarnings)` mit unveränderter Signatur und unverändertem `Snapshot`

- [ ] **Step 1: Typen anpassen** (`src/domain/types.ts`)

`Team` wird zu:

```ts
export interface Team {
  name: string;
  group: Group;
}
```

Beim `Match`-Kommentar an `home` steht künftig: `/** Text aus Spalte Team A/B: Teamname oder Platzhalter wie '1. Gr. A', 'Sieger HF1' */`

`TournamentData` wird zu:

```ts
export interface TournamentData {
  settings: Settings;
  teams: Team[];
  /** von der Tabelle fertig aufgelöst */
  matches: ResolvedMatch[];
  players: Player[];
  tables: GroupTable[];
  /** Index 0 = Platz 1; null = noch offen */
  ranking: (string | null)[];
}
```

`TournamentData` steht bisher vor `StandingRow`/`GroupTable`/`ResolvedMatch`. Interfaces dürfen in TypeScript vorwärts referenziert werden, die Reihenfolge bleibt also.

- [ ] **Step 2: Failing parser tests schreiben** (`src/data/parse.test.ts`)

`base()` ersetzen durch:

```ts
const groupCsv = (g: string, teams: string[], hint = '') =>
  csv([
    ['Platz', 'Code', 'Team', 'Sp', 'S', 'U', 'N', 'Tore', 'Gegentore', 'Diff', 'Pkt', 'Hinweis'],
    ...teams.map((t, i) => [String(i + 1), `${g}${i + 1}`, t, '1', i === 0 ? '1' : '0', '0', i === 0 ? '0' : '1', i === 0 ? '2' : '1', i === 0 ? '1' : '2', i === 0 ? '1' : '-1', i === 0 ? '3' : '0', hint]),
  ]);

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
    ['Code', 'Team', 'Gruppe', 'Los'],
    ['A1', 'Rot', 'A', ''],
    ['A2', 'Blau', 'A', '1'],
    ['B1', 'Grün', 'B', ''],
    ['B2', 'Gelb', 'B', ''],
  ]),
  Spielplan: csv([
    ['Nr.', 'Phase', 'Zeit', 'Runde', 'Code A', 'Team A', 'Code B', 'Team B', 'Tore A', 'Tore B', 'Sieger', 'Sieger-Code', 'Verlierer-Code'],
    ['1', 'Gruppenphase', '14:00', 'Gruppe A', 'A1', 'Rot', 'A2', 'Blau', '2', '1', 'Rot', 'A1', 'A2'],
    ['2', 'Gruppenphase', '14:12', 'Gruppe B', 'B1', 'Grün', 'B2', 'Gelb', '', '', '', '', ''],
    ['3', 'Halbfinale', '14:24', 'Halbfinale 1', 'A1', 'Rot', '', '2. Gr. B', '', '', '', '', ''],
  ]),
  Spieler: csv([
    ['Name', 'Team', 'Tore'],
    ['Max', 'Rot', '2'],
    ['Moritz', 'Blau', ''],
  ]),
  'Gruppe A': groupCsv('A', ['Rot', 'Blau']),
  'Gruppe B': groupCsv('B', ['Grün', 'Gelb']),
  Endplatzierung: csv([['Platz', 'Team', 'Gruppe', 'Herkunft'], ['1', 'Rot', 'A', 'Sieger Finale'], ['2', '', '', 'Verlierer Finale']]),
});
```

Den Test „liest gültige Daten ohne Warnungen“ ersetzen durch:

```ts
  it('liest gültige Daten ohne Warnungen', () => {
    const { data, warnings } = parseTournament(base());
    expect(warnings).toEqual([]);
    expect(data.settings).toEqual({
      name: 'Test-Turnier', date: '14.11.2026', startMinutes: 840, matchMinutes: 10, breakMinutes: 2,
    });
    expect(data.teams).toEqual([
      { name: 'Rot', group: 'A' }, { name: 'Blau', group: 'A' }, { name: 'Grün', group: 'B' }, { name: 'Gelb', group: 'B' },
    ]);
    expect(data.matches[0]).toEqual({
      nr: 1, round: 'Gruppe A', group: 'A', home: 'Rot', away: 'Blau', homeGoals: 2, awayGoals: 1,
      homeSide: { team: 'Rot', label: 'Rot' }, awaySide: { team: 'Blau', label: 'Blau' },
      winner: 'Rot', loser: 'Blau', undecided: false,
    });
    expect(data.matches[2]).toMatchObject({
      nr: 3, group: null, homeSide: { team: 'Rot', label: 'Rot' }, awaySide: { team: null, label: '2. Gr. B' }, winner: null,
    });
    expect(data.tables[0]).toEqual({
      group: 'A', complete: true,
      rows: [
        { rank: 1, team: 'Rot', played: 1, won: 1, drawn: 0, lost: 0, goalsFor: 2, goalsAgainst: 1, diff: 1, points: 3, lotPending: false },
        { rank: 2, team: 'Blau', played: 1, won: 0, drawn: 0, lost: 1, goalsFor: 1, goalsAgainst: 2, diff: -1, points: 0, lotPending: false },
      ],
    });
    expect(data.ranking).toEqual(['Rot', null]);
    expect(data.players).toEqual([
      { name: 'Max', team: 'Rot', goals: 2 },
      { name: 'Moritz', team: 'Blau', goals: 0 },
    ]);
  });

  it('übernimmt „Los ausstehend“ und erkennt unvollständige Gruppen', () => {
    const raw = { ...base(), 'Gruppe B': groupCsv('B', ['Grün', 'Gelb'], 'Los ausstehend') };
    const t = parseTournament(raw).data.tables[1];
    expect(t.rows.every((r) => r.lotPending)).toBe(true);
    const open = { ...base(), 'Gruppe A': groupCsv('A', ['Rot', 'Blau']).replace(/"1","A1","Rot","1"/, '"1","A1","Rot","0"') };
    expect(parseTournament(open).data.tables[0].complete).toBe(false);
  });

  it('meldet ein Unentschieden im K.-o.-Spiel als unbestimmt', () => {
    const raw = { ...base(), Spielplan: base().Spielplan.replace('"Rot","","2. Gr. B","","",""', '"Rot","B2","Gelb","3","3","Unentschieden"') };
    expect(parseTournament(raw).data.matches[2]).toMatchObject({ winner: null, loser: null, undecided: true });
  });

  it('verwirft Tabellenzeilen mit ungültigen Zahlen', () => {
    const raw = { ...base(), 'Gruppe A': groupCsv('A', ['Rot', 'Blau']).replace('"-1"', '"x"') };
    const { data, warnings } = parseTournament(raw);
    expect(data.tables[0].rows.map((r) => r.team)).toEqual(['Rot']);
    expect(warnings).toContain('Gruppe A: Zeile „Blau“ enthält ungültige Zahlen, ignoriert.');
  });
```

In den übrigen Tests werden die alten Spaltennamen ersetzt. Die Tests zu Startzeit, Pause, Teams, ungültigen Toren, halbem Ergebnis, falschem Blatt und leerem Blatt bleiben sonst unverändert:
- „verwirft Teams mit ungültiger Gruppe oder doppeltem Namen“: Teams-CSV wird `csv([['Code', 'Team', 'Gruppe', 'Los'], ['A1', 'Rot', 'A', ''], ['A2', 'Rot', 'B', ''], ['A3', 'Lila', 'C', '']])`.
- „verwirft Spiele mit unbekanntem Team und doppelter Nr.“: Spielplan-CSV wird
  ```ts
      Spielplan: csv([
        ['Nr.', 'Runde', 'Team A', 'Team B', 'Tore A', 'Tore B', 'Sieger'],
        ['1', 'Gruppe A', 'Rot', 'Pink', '', '', ''],
        ['2', 'Gruppe A', 'Rot', 'Blau', '', '', ''],
        ['2', 'Gruppe B', 'Grün', 'Gelb', '', '', ''],
      ]),
  ```
- Der Test „parst die Demo-Dateien ohne Warnungen“ wird gelöscht. Task 6 legt ihn mit den neuen Demo-Dateien wieder an.
- Der Import von `readFileSync` entfällt, falls er danach unbenutzt ist.

- [ ] **Step 3: Tests laufen lassen, sie müssen fehlschlagen**

Run: `npx vitest run src/data/parse.test.ts`
Expected: FAIL (Spalten „Team A“ usw. unbekannt, `tables` fehlt)

- [ ] **Step 4: Parser implementieren** (`src/data/parse.ts`, komplett ersetzen)

```ts
import Papa from 'papaparse';
import type { Group, GroupTable, Player, ResolvedMatch, Settings, Side, StandingRow, Team, TournamentData } from '../domain/types';

export const SHEET_NAMES = ['Einstellungen', 'Teams', 'Spielplan', 'Spieler', 'Gruppe A', 'Gruppe B', 'Endplatzierung'] as const;
export type SheetName = (typeof SHEET_NAMES)[number];
export type RawSheets = Record<SheetName, string>;

/** Nur die Anzeige-Bereiche lesen – die Rechenhilfe darunter würde die gviz-Typerkennung stören */
export const SHEET_RANGES: Partial<Record<SheetName, string>> = { 'Gruppe A': 'A1:L6', 'Gruppe B': 'A1:L6', Endplatzierung: 'A1:D11' };

type Row = Record<string, string>;

// gviz exportiert Ganzzahlen gelegentlich als "3.0"
const int = (s: string): number | null => (/^\d+(\.0+)?$/.test(s) ? parseInt(s, 10) : null);
const signedInt = (s: string): number | null => (/^-?\d+(\.0+)?$/.test(s) ? parseInt(s, 10) : null);

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
```

Dahinter folgt die bestehende `parseTeams` mit zwei Änderungen: Das Los wird nicht mehr gelesen, und `teams.push({ name, group })`. Die Prüfungen auf ungültige Gruppe und doppelten Namen bleiben wörtlich erhalten. Lies dazu die aktuelle Funktion in `src/data/parse.ts` (Zeilen 55–75) und entferne nur die Los-Zeilen (`rawLot`, `lot`, die Warnung „Los … ist keine Ganzzahl“).

```ts
function parseMatches(rows: Row[], teams: Team[], w: string[]): ResolvedMatch[] {
  const names = new Set(teams.map((t) => t.name));
  const side = (s: string): Side => ({ team: names.has(s) ? s : null, label: s });
  const matches: ResolvedMatch[] = [];
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
    const home = r['Team A'];
    const away = r['Team B'];
    const bad = group
      ? [home, away].find((s) => !teams.some((t) => t.name === s && t.group === group))
      : [home, away].find((s) => s === '');
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
    const homeGoals = goals(r['Tore A']);
    const awayGoals = goals(r['Tore B']);
    const homeSide = side(home);
    const awaySide = side(away);
    const winner = names.has(r['Sieger']) ? r['Sieger'] : null;
    const loser = winner === null ? null : winner === homeSide.team ? awaySide.team : homeSide.team;
    const finished = homeGoals !== null && awayGoals !== null;
    matches.push({
      nr, round: r['Runde'], group, home, away, homeGoals, awayGoals, homeSide, awaySide, winner, loser,
      undecided: group === null && finished && r['Sieger'] === 'Unentschieden',
    });
  }
  return matches;
}

function parseGroup(rows: Row[], group: Group, w: string[]): GroupTable {
  const out: StandingRow[] = [];
  for (const r of rows) {
    const team = r['Team'];
    if (!team) continue;
    const n = ['Platz', 'Sp', 'S', 'U', 'N', 'Tore', 'Gegentore', 'Diff', 'Pkt'].map((k) => signedInt(r[k]));
    if (n.some((x) => x === null)) {
      w.push(`Gruppe ${group}: Zeile „${team}“ enthält ungültige Zahlen, ignoriert.`);
      continue;
    }
    const [rank, played, won, drawn, lost, goalsFor, goalsAgainst, diff, points] = n as number[];
    out.push({ rank, team, played, won, drawn, lost, goalsFor, goalsAgainst, diff, points, lotPending: r['Hinweis'] === 'Los ausstehend' });
  }
  return { group, rows: out, complete: out.length > 0 && out.every((x) => x.played === out.length - 1) };
}

function parseRanking(rows: Row[]): (string | null)[] {
  const ranking: (string | null)[] = [];
  for (const r of rows) {
    const p = int(r['Platz']);
    if (p !== null && p > 0) ranking[p - 1] = r['Team'] || null;
  }
  return Array.from(ranking, (t) => t ?? null);
}
```

Danach folgt die bestehende `parsePlayers`, unverändert. Zum Schluss:

```ts
export function parseTournament(raw: RawSheets): { data: TournamentData; warnings: string[] } {
  const w: string[] = [];
  const settings = parseSettings(table(raw.Einstellungen, 'Einstellungen', ['Feld', 'Wert'], w), w);
  const teams = parseTeams(table(raw.Teams, 'Teams', ['Team', 'Gruppe'], w), w);
  const matches = parseMatches(
    table(raw.Spielplan, 'Spielplan', ['Nr.', 'Runde', 'Team A', 'Team B', 'Tore A', 'Tore B', 'Sieger'], w), teams, w,
  );
  const players = parsePlayers(table(raw.Spieler, 'Spieler', ['Name', 'Team', 'Tore'], w), teams, w);
  const groupCols = ['Platz', 'Team', 'Sp', 'S', 'U', 'N', 'Tore', 'Gegentore', 'Diff', 'Pkt', 'Hinweis'];
  const tables = (['A', 'B'] as const).map((g) => parseGroup(table(raw[`Gruppe ${g}`], `Gruppe ${g}`, groupCols, w), g, w));
  const ranking = parseRanking(table(raw.Endplatzierung, 'Endplatzierung', ['Platz', 'Team'], w));
  return { data: { settings, teams, matches, players, tables, ranking }, warnings: w };
}
```

`isPlaceholder` und `PLACEHOLDER` entfallen. Danach mit `grep -rn isPlaceholder src` prüfen, ob sie noch irgendwo benutzt werden. Erwartet: keine Treffer.

- [ ] **Step 5: Parser-Tests laufen lassen, sie müssen grün sein**

Run: `npx vitest run src/data/parse.test.ts`
Expected: PASS

- [ ] **Step 6: sheets.ts anpassen (Test zuerst)**

In `src/data/sheets.test.ts` ersetzen bzw. ergänzen:

```ts
  it('nutzt ohne Sheet-ID die Demo-Dateien unter base', () => {
    expect(sheetUrl('', 'Teams', '/Stammtisch-Turnier/')).toBe('/Stammtisch-Turnier/demo/Teams.csv');
    expect(sheetUrl('', 'Gruppe A', '/')).toBe('/demo/Gruppe%20A.csv');
  });

  it('begrenzt Gruppenblätter auf den Anzeige-Bereich', () => {
    expect(sheetUrl('abc', 'Gruppe B', '/')).toBe(
      'https://docs.google.com/spreadsheets/d/abc/gviz/tq?tqx=out:csv&headers=1&sheet=Gruppe%20B&range=A1:L6',
    );
  });
```

Im Test „lädt alle 4 Blätter …“ ändern sich der Titel zu „lädt alle Blätter …“ und die Erwartung zu `expect(calls).toHaveLength(7);`.

`src/data/sheets.ts`, `sheetUrl`:

```ts
import { SHEET_NAMES, SHEET_RANGES, type RawSheets, type SheetName } from './parse';

export function sheetUrl(sheetId: string, sheet: SheetName, base: string): string {
  if (!sheetId) return `${base}demo/${encodeURIComponent(sheet)}.csv`;
  const range = SHEET_RANGES[sheet];
  return `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv&headers=1&sheet=${encodeURIComponent(sheet)}${range ? `&range=${range}` : ''}`;
}
```

Run: `npx vitest run src/data/sheets.test.ts`
Expected: PASS

- [ ] **Step 7: Snapshot ohne eigene Wertung (Test zuerst)**

`src/domain/snapshot.test.ts` komplett ersetzen:

```ts
import { describe, expect, it } from 'vitest';
import { groupTable, settings, team } from './fixtures';
import { buildSnapshot } from './snapshot';
import type { ResolvedMatch, TournamentData } from './types';

const match = (nr: number, home: string, away: string, score?: [number, number], extra: Partial<ResolvedMatch> = {}): ResolvedMatch => ({
  nr, round: 'Test', group: null, home, away, homeGoals: score?.[0] ?? null, awayGoals: score?.[1] ?? null,
  homeSide: { team: home, label: home }, awaySide: { team: away, label: away }, winner: null, loser: null, undecided: false,
  ...extra,
});

const data = (matches: ResolvedMatch[], ranking: (string | null)[] = []): TournamentData => ({
  settings: settings(), teams: [team('X', 'A'), team('Y', 'A')], matches, players: [], tables: [groupTable('A', ['X', 'Y'])], ranking,
});

describe('buildSnapshot', () => {
  it('sortiert nach Nr., plant Startzeiten und findet das laufende Spiel', () => {
    const s = buildSnapshot(data([match(2, 'X', 'Y'), match(1, 'X', 'Y', [1, 0])]));
    expect(s.matches.map((x) => [x.nr, x.startMinutes, x.finished])).toEqual([[1, 840, true], [2, 852, false]]);
    expect(s.liveIndex).toBe(1);
    expect(s.lastIndex).toBe(0);
    expect(s.champion).toBeNull();
  });

  it('übernimmt Tabellen und Endplatzierung aus den Daten', () => {
    const s = buildSnapshot(data([match(1, 'X', 'Y', [1, 0])], ['X', 'Y']));
    expect(s.tables[0].rows.map((r) => r.team)).toEqual(['X', 'Y']);
    expect(s.ranking).toEqual(['X', 'Y']);
    expect(s.champion).toBe('X');
    expect(s.rest[0]).toMatchObject({ team: 'X', status: 'done', place: 1 });
  });

  it('warnt bei Unentschieden im K.-o.-Spiel und übernimmt Parser-Warnungen', () => {
    const s = buildSnapshot(data([match(3, 'X', 'Y', [2, 2], { undecided: true })]), ['vom Parser']);
    expect(s.warnings).toEqual(['vom Parser', 'Spiel 3: Unentschieden im K.-o.-Spiel – Sieger unbestimmt.']);
  });
});
```

`src/domain/fixtures.ts` bekommt drei Änderungen:
- `team` wird zu `export const team = (name: string, group: Group): Team => ({ name, group });`
- `ko` wird gelöscht.
- Der Import passt sich an, `Match` bleibt für `m`.

Run: `npx vitest run src/domain/snapshot.test.ts`
Expected: FAIL (`buildSnapshot` ruft noch `computeStandings` auf und erzeugt andere Tabellen bzw. andere Werte)

- [ ] **Step 8: Snapshot implementieren und alte Wertung löschen**

`src/domain/snapshot.ts` komplett ersetzen:

```ts
import { restOverview } from './rest';
import { findLast, findLive, findNext, plannedStart, sortByNr } from './schedule';
import { scorerList } from './scorers';
import type { ScheduledMatch, Snapshot, TournamentData } from './types';
import { isFinished } from './types';

/** Ordnet die fertig gerechneten Daten der Tabelle für die Anzeige an – gewertet wird nur in der Tabelle. */
export function buildSnapshot(data: TournamentData, parseWarnings: string[] = []): Snapshot {
  const warnings = [...parseWarnings];
  const matches: ScheduledMatch[] = sortByNr(data.matches).map((x, index) => ({
    ...x, index, startMinutes: plannedStart(index, data.settings), finished: isFinished(x),
  }));
  for (const x of matches) if (x.undecided) warnings.push(`Spiel ${x.nr}: Unentschieden im K.-o.-Spiel – Sieger unbestimmt.`);
  const liveIndex = findLive(matches);
  const { ranking } = data;
  return {
    settings: data.settings,
    tables: data.tables,
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

Run:

```bash
git rm src/domain/standings.ts src/domain/standings.test.ts src/domain/bracket.ts src/domain/bracket.test.ts
```

- [ ] **Step 9: Alles prüfen**

Run: `npx vitest run src && npm run check`
Expected: Alle Tests unter `src/` grün, `svelte-check` ohne Fehler. Meldet `svelte-check` Fehler zu `lot` oder `TournamentData`, diese Stellen an die neuen Typen anpassen. Die UI-Komponenten selbst sollten unverändert bleiben, weil `Snapshot` gleich ist.

- [ ] **Step 10: Commit**

```bash
git add -A src
git commit -m "feat: Webseite liest Tabellen, K.-o. und Endstand aus der Tabelle statt selbst zu rechnen"
```

---

### Task 6: Demo-Daten aus der Vorlage erzeugen und End-to-End prüfen

**Files:**
- Create: `tools/demo.ts`
- Create: `tools/demo.test.ts`
- Modify: `package.json` (Skript `demo`)
- Modify: `public/demo/*.csv` (neu erzeugt, 7 Dateien; `Gruppe A.csv`, `Gruppe B.csv`, `Endplatzierung.csv` sind neu)
- Modify: `src/data/parse.test.ts` (Demo-Test wieder aufnehmen)

**Interfaces:**
- Consumes: `buildWorkbook` (Task 3/4), `calculate` (Task 1), `SHEET_NAMES`, `SHEET_RANGES`, `parseTournament` (Task 5), `buildSnapshot` (Task 5)
- Produces:
  - `demoWorkbook(): ExcelJS.Workbook`
  - `toCsvs(wb: ExcelJS.Workbook): RawSheets` (rechnet und schreibt jedes App-Blatt als CSV, bei `SHEET_RANGES` nur den Bereich)
  - `npm run demo` schreibt `public/demo/<Blatt>.csv`

- [ ] **Step 1: Failing test schreiben** (`tools/demo.test.ts`)

```ts
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseTournament, SHEET_NAMES } from '../src/data/parse.ts';
import { buildSnapshot } from '../src/domain/snapshot.ts';
import { demoWorkbook, toCsvs } from './demo.ts';

describe('Demo-Daten', () => {
  it('sind aktuell (npm run demo nach Änderungen an Vorlage oder Demo)', () => {
    const csvs = toCsvs(demoWorkbook());
    for (const s of SHEET_NAMES) {
      // git kann unter Windows CRLF auschecken
      expect(readFileSync(new URL(`../public/demo/${s}.csv`, import.meta.url), 'utf8').replace(/
/g, '
'), s).toBe(csvs[s]);
    }
  });

  it('ergeben einen stimmigen Zwischenstand ohne Warnungen', () => {
    const { data, warnings } = parseTournament(toCsvs(demoWorkbook()));
    expect(warnings).toEqual([]);
    const s = buildSnapshot(data, warnings);
    expect(data.teams).toHaveLength(10);
    expect(data.players).toHaveLength(10);
    expect(s.matches).toHaveLength(27);
    expect(s.liveIndex).toBe(11);
    expect(s.matches[11]).toMatchObject({ nr: 12, startMinutes: 840 + 11 * 12 });
    expect(s.tables[0].rows[0].team).toBe('FC Bierbauch');
    expect(s.tables[1].rows[0].team).toBe('Trachtler');
    expect(s.matches[21].homeSide).toEqual({ team: null, label: '1. Gr. A' });
    expect(s.champion).toBeNull();
  });

  it('rechnet ein komplettes Turnier mit eigenen Teamnamen bis zum Sieger durch', () => {
    const wb = demoWorkbook();
    const plan = wb.getWorksheet('Spielplan')!;
    // Los für alle, damit kein Gleichstand die K.-o.-Runde blockiert
    for (let r = 2; r <= 11; r++) wb.getWorksheet('Teams')!.getCell(`D${r}`).value = r - 1;
    // Restliche Gruppenspiele 0:1, K.-o. alle 1:0 für Team A
    for (let r = 13; r <= 21; r++) [plan.getCell(`I${r}`).value, plan.getCell(`J${r}`).value] = [0, 1];
    for (let r = 22; r <= 28; r++) [plan.getCell(`I${r}`).value, plan.getCell(`J${r}`).value] = [1, 0];
    const { data, warnings } = parseTournament(toCsvs(wb));
    const s = buildSnapshot(data, warnings);
    expect(warnings).toEqual([]);
    expect(s.liveIndex).toBeNull();
    expect(s.ranking.every((t) => t !== null)).toBe(true);
    expect(new Set(s.ranking).size).toBe(10);
    expect(s.champion).toBe(s.ranking[0]);
    expect(s.matches[26].winner).toBe(s.champion);
    expect(s.rest.every((r) => r.status === 'done' && r.place !== null)).toBe(true);
  });
});
```

- [ ] **Step 2: Test laufen lassen, er muss fehlschlagen**

Run: `npx vitest run tools/demo.test.ts`
Expected: FAIL („Cannot find module './demo.ts'“)

- [ ] **Step 3: Implementieren** (`tools/demo.ts`)

```ts
import { mkdirSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import type ExcelJS from 'exceljs';
import { SHEET_NAMES, SHEET_RANGES, type RawSheets } from '../src/data/parse.ts';
import { calculate } from './calc.ts';
import { buildWorkbook } from './template.ts';

const TEAMS = [
  'FC Bierbauch', 'Stammtisch Mitte', 'Die Wadlbeißer', 'Saaldorfer Buam', 'Alte Herren',
  'Feuerwehr', 'Schützenverein', 'Kegelclub', 'Trachtler', 'Burschenverein',
];
/** Ergebnisse der Spiele 1–11 (Spiel 12 läuft gerade) */
const SCORES: [number, number][] = [[2, 1], [0, 0], [3, 2], [1, 2], [1, 1], [2, 0], [0, 2], [3, 1], [2, 2], [1, 0], [1, 0]];
const PLAYERS: [string, string, number | null][] = [
  ['Max Huber', 'FC Bierbauch', 3], ['Sepp Maier', 'Die Wadlbeißer', 3], ['Toni Gruber', 'Schützenverein', 3],
  ['Flo Wimmer', 'Saaldorfer Buam', 2], ['Hans Berger', 'Feuerwehr', 2], ['Michi Schmid', 'Alte Herren', 2],
  ['Basti Hofer', 'Trachtler', 2], ['Lukas Brandl', 'Kegelclub', 1], ['Andi Reiter', 'Stammtisch Mitte', 1],
  ['Quirin Stadler', 'Burschenverein', null],
];

export function demoWorkbook(): ExcelJS.Workbook {
  const wb = buildWorkbook();
  wb.getWorksheet('Einstellungen')!.getCell('B2').value = 'Stammtischturnier 2026 (Demo)';
  const teams = wb.getWorksheet('Teams')!;
  TEAMS.forEach((name, k) => (teams.getCell(`B${k + 2}`).value = name));
  const plan = wb.getWorksheet('Spielplan')!;
  SCORES.forEach(([a, b], k) => {
    plan.getCell(`I${k + 2}`).value = a;
    plan.getCell(`J${k + 2}`).value = b;
  });
  const players = wb.getWorksheet('Spieler')!;
  players.spliceRows(2, players.rowCount);
  for (const p of PLAYERS) players.addRow(p);
  return wb;
}

const quote = (v: unknown) => `"${(v === null || v === undefined ? '' : String(v)).replace(/"/g, '""')}"`;

/** So, wie gviz die Blätter als CSV liefert: berechnete Werte, alles in Anführungszeichen */
export function toCsvs(wb: ExcelJS.Workbook): RawSheets {
  const c = calculate(wb);
  const out = {} as RawSheets;
  for (const name of SHEET_NAMES) {
    const ws = wb.getWorksheet(name)!;
    const range = SHEET_RANGES[name] ?? `A1:${ws.getColumn(ws.columnCount).letter}${ws.rowCount}`;
    out[name] = c.table(name, range).map((row) => row.map(quote).join(',')).join('\n') + '\n';
  }
  return out;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  mkdirSync('public/demo', { recursive: true });
  for (const [name, csv] of Object.entries(toCsvs(demoWorkbook()))) writeFileSync(`public/demo/${name}.csv`, csv);
  console.log('public/demo/*.csv geschrieben');
}
```

In `package.json` unter `scripts` ergänzen: `"demo": "node tools/demo.ts"`.

- [ ] **Step 4: Demo-Dateien erzeugen und Tests laufen lassen**

Run: `npm run demo && npx vitest run tools/demo.test.ts`
Expected: „public/demo/*.csv geschrieben“, danach PASS (3 Tests). Ist der Erste nach Gruppe A nicht „FC Bierbauch“ bzw. nach Gruppe B nicht „Trachtler“, zuerst `public/demo/Gruppe A.csv` ansehen. Die Demo-Ergebnisse sind dieselben wie bisher, die alte App-Wertung kam auf genau diese Spitzenreiter.

- [ ] **Step 5: Parser-Demo-Test wieder aufnehmen** (`src/data/parse.test.ts`, am Ende des `describe`)

```ts
  it('parst die Demo-Dateien ohne Warnungen', () => {
    const raw = Object.fromEntries(
      SHEET_NAMES.map((s) => [s, readFileSync(new URL(`../../public/demo/${s}.csv`, import.meta.url), 'utf8')]),
    ) as RawSheets;
    const { data, warnings } = parseTournament(raw);
    expect(warnings).toEqual([]);
    expect(data.matches).toHaveLength(27);
    expect(data.matches.filter((m) => m.homeGoals !== null && m.awayGoals !== null)).toHaveLength(11);
    expect(data.tables.map((t) => t.rows.length)).toEqual([5, 5]);
    expect(data.ranking).toEqual(Array(10).fill(null));
  });
```

Den Import `import { readFileSync } from 'node:fs';` wieder ergänzen, falls er in Task 5 entfernt wurde.

- [ ] **Step 6: Gesamte Suite**

Run: `npm test && npm run check && npm run build`
Expected: alles grün, Build ohne Fehler

- [ ] **Step 7: Commit**

```bash
git add tools/demo.ts tools/demo.test.ts package.json public/demo src/data/parse.test.ts
git commit -m "feat: Demo-Daten aus der Vorlage gerechnet, End-to-End-Test"
```

---

### Task 7: Doku und Browser-Check

**Files:**
- Modify: `README.md`
- Modify: `docs/superpowers/specs/2026-10-10-stammtisch-turnier-design.md` (Nachtrag oben)

- [ ] **Step 1: README anpassen**

Im Abschnitt zur Google-Tabelle (bisher Zeile 7–14) ersetzen bzw. ergänzen:
- Ergebnisse werden nur im Blatt `Spielplan` in die gelben Spalten `Tore A` und `Tore B` eingetragen, zwei Zahlen in zwei Zellen. K.-o. mit Neunmeter als Gesamtergebnis.
- Teamnamen stehen im Blatt `Teams` in der Spalte `Team`, ein Los bei Bedarf in `Los`. `Code` und `Gruppe` bitte nicht ändern.
- Alles andere rechnet die Tabelle selbst: Gruppen A/B, K.-o.-Paarungen, Turnierbaum und Endplatzierung. Graue Rechenhilfe und Formelzellen nicht überschreiben.
- Neue Checkliste „Nach dem Upload prüfen“:
  1. Die Zeiten im Spielplan beginnen mit der Startzeit.
  2. Nach dem Eintragen von zwei Test-Ergebnissen erscheinen die Sieger und die Gruppentabelle ändert sich.
  3. Ist eine Gruppe vollständig eingetragen, steht im Halbfinale ein echter Teamname.
  4. Die Webseite zeigt nach höchstens 30 s dieselbe Tabelle.
  5. Test-Ergebnisse wieder löschen.
- Bei den Befehlen zusätzlich `npm run demo   # Demo-CSVs aus der Vorlage neu rechnen`.

- [ ] **Step 2: Nachtrag im Haupt-Design**

Direkt unter die Überschrift von `docs/superpowers/specs/2026-10-10-stammtisch-turnier-design.md` setzen:

```markdown
> **Nachtrag 10.10.2026:** Gewertet wird jetzt ausschließlich in der Google-Tabelle. Die Abschnitte zu den Blättern, zur Tabellenberechnung in der App und zum Bracket gelten nur noch, soweit `2026-10-10-excel-rechnet-design.md` nichts anderes sagt.
```

- [ ] **Step 3: Browser-Check**

Dev-Server per `preview_start` starten. Dann prüfen:
- **Jetzt:** Spiel 12 läuft, und die nächsten zwei Spiele stehen darunter.
- **Spielplan:** Spiele 21–27 zeigen „1. Gr. A“ usw.
- **Tabellen:** Gruppe A ist von FC Bierbauch angeführt, Gruppe B von Trachtler. Die Tordifferenzen haben Vorzeichen.
- **Finalrunde:** Die Platzhalter werden angezeigt, aber noch kein Endstand.
- **Torschützen:** unverändert.
- **Konsole:** keine Fehler. Die Warnbox ist nicht sichtbar.

Screenshot für den Nutzer machen.

- [ ] **Step 4: Commit**

```bash
git add README.md docs/superpowers/specs/2026-10-10-stammtisch-turnier-design.md
git commit -m "docs: Anleitung für die rechnende Tabelle"
```
