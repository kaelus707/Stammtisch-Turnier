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
