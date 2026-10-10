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
