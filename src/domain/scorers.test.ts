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
