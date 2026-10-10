// Nur für Tests.
import type { Group, GroupTable, Match, ScheduledMatch, Settings, Team } from './types';

export const settings = (over: Partial<Settings> = {}): Settings => ({
  name: 'Test', date: '14.11.2026', startMinutes: 14 * 60, matchMinutes: 10, breakMinutes: 2, ...over,
});

export const team = (name: string, group: Group, lot: number | null = null): Team => ({ name, group, lot });

/** Gruppenspiel (oder beliebiges Spiel) mit optionalem Ergebnis */
export const m = (nr: number, home: string, away: string, score?: [number, number], group: Group | null = 'A'): Match => ({
  nr, round: group ? `Gruppe ${group}` : 'Test', group, home, away,
  homeGoals: score ? score[0] : null, awayGoals: score ? score[1] : null,
});

/** Finalrundenspiel */
export const ko = (nr: number, round: string, home: string, away: string, score?: [number, number]): Match => ({
  ...m(nr, home, away, score, null), round,
});

/** Fertige Tabelle in der angegebenen Reihenfolge, ohne Statistik */
export const groupTable = (group: Group, names: string[], complete = true, pending: number[] = []): GroupTable => ({
  group,
  complete,
  rows: names.map((team, i) => ({
    team, rank: i + 1, played: 4, won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0, diff: 0, points: 0,
    lotPending: pending.includes(i),
  })),
});

/** Geplantes Spiel; null als Team = unaufgelöster Platzhalter */
export const scheduled = (index: number, home: string | null, away: string | null, finished = false): ScheduledMatch => ({
  nr: index + 1, round: 'Test', group: null,
  home: home ?? 'A1', away: away ?? 'B2',
  homeGoals: finished ? 1 : null, awayGoals: finished ? 0 : null,
  homeSide: { team: home, label: home ?? 'A1' }, awaySide: { team: away, label: away ?? 'B2' },
  winner: null, loser: null, undecided: false,
  index, startMinutes: 840 + index * 12, finished,
});
