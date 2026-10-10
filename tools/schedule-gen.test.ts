import { describe, expect, it } from 'vitest';
import { GROUP_ORDER, planRows, sideLabel, type Slot } from './schedule-gen.ts';

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
      expect(r.phase).toBe('Gruppenphase');
    }
  });

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
});
