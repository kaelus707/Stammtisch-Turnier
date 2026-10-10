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
