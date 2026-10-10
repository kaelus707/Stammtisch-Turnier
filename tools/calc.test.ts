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
