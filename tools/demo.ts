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
