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
