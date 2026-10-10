// Nur für Tests.
import type { Group, GroupTable, Match, Settings, Team } from './types';

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
