import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { planRows, type Slot } from '../../tools/schedule-gen';
import { parseTournament, SHEET_NAMES, type RawSheets } from '../data/parse';
import { settings, team } from './fixtures';
import { buildSnapshot } from './snapshot';
import type { Group, TournamentData } from './types';

function fullTournament(score: (nr: number) => [number, number] | null): TournamentData {
  const name = (s: Slot | string) => (typeof s === 'string' ? s : `Team ${s.group}${s.i + 1}`);
  const teams = (['A', 'B'] as const).flatMap((g) => [0, 1, 2, 3, 4].map((i) => team(`Team ${g}${i + 1}`, g)));
  const matches = planRows().map((r) => {
    const sc = score(r.nr);
    const g = /^Gruppe ([AB])$/.exec(r.round);
    return {
      nr: r.nr, round: r.round, group: g ? (g[1] as Group) : null, home: name(r.home), away: name(r.away),
      homeGoals: sc ? sc[0] : null, awayGoals: sc ? sc[1] : null,
    };
  });
  return { settings: settings(), teams, matches, players: [] };
}

describe('buildSnapshot', () => {
  it('setzt die Demo-Daten zu einem stimmigen Zwischenstand zusammen', () => {
    const raw = Object.fromEntries(
      SHEET_NAMES.map((s) => [s, readFileSync(new URL(`../../public/demo/${s}.csv`, import.meta.url), 'utf8')]),
    ) as RawSheets;
    const { data, warnings } = parseTournament(raw);
    const s = buildSnapshot(data, warnings);
    expect(s.liveIndex).toBe(11);
    expect(s.matches[11]).toMatchObject({ nr: 12, startMinutes: 840 + 11 * 12 });
    expect(s.nextIndices).toEqual([12, 13]);
    expect(s.lastIndex).toBe(10);
    expect(s.tables[0].rows[0].team).toBe('FC Bierbauch');
    expect(s.tables[1].rows[0].team).toBe('Trachtler');
    expect(s.rest.slice(0, 2).map((r) => r.status)).toEqual(['playing', 'playing']);
    expect(s.rest.slice(0, 2).map((r) => r.team).sort()).toEqual(['Feuerwehr', 'Kegelclub']);
    expect(s.matches[21].homeSide).toEqual({ team: null, label: 'A1' });
    expect(s.scorers[0].rank).toBe(1);
    expect(s.champion).toBeNull();
    expect(s.warnings).toEqual([]);
  });

  it('ermittelt nach dem letzten Spiel Endstand und Turniersieger', () => {
    const s = buildSnapshot(fullTournament(() => [1, 0]));
    expect(s.liveIndex).toBeNull();
    expect(s.ranking).toEqual([
      'Team A1', 'Team A2', 'Team B2', 'Team B1', 'Team A3', 'Team B3', 'Team A4', 'Team B4', 'Team A5', 'Team B5',
    ]);
    expect(s.champion).toBe('Team A1');
    expect(s.rest.every((r) => r.status === 'done' && r.place !== null)).toBe(true);
    expect(s.rest[0]).toMatchObject({ team: 'Team A1', place: 1 });
  });

  it('warnt bei Unentschieden im K.-o.-Spiel und übernimmt Parser-Warnungen', () => {
    const s = buildSnapshot(fullTournament((nr) => (nr === 22 ? [2, 2] : nr <= 22 ? [1, 0] : null)), ['vom Parser']);
    expect(s.warnings).toEqual(['vom Parser', 'Spiel 22: Unentschieden im K.-o.-Spiel – Sieger unbestimmt.']);
    expect(s.matches[25].homeSide.label).toBe('Verlierer HF1');
  });
});
