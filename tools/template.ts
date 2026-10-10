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
