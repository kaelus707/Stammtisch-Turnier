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
