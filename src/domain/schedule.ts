import type { Match, Settings } from './types';
import { isFinished } from './types';

export const sortByNr = <T extends Match>(ms: T[]): T[] => [...ms].sort((a, b) => a.nr - b.nr);

export function plannedStart(index: number, s: Settings): number | null {
  if (s.startMinutes === null || s.matchMinutes === null) return null;
  return s.startMinutes + index * (s.matchMinutes + s.breakMinutes);
}

export function formatTime(min: number | null): string {
  if (min === null) return '–';
  const t = ((min % 1440) + 1440) % 1440;
  return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
}

export function findLive(sorted: Match[]): number | null {
  const i = sorted.findIndex((x) => !isFinished(x));
  return i === -1 ? null : i;
}

export function findNext(sorted: Match[], live: number | null, count = 2): number[] {
  if (live === null) return [];
  const out: number[] = [];
  for (let i = live + 1; i < sorted.length && out.length < count; i++) if (!isFinished(sorted[i])) out.push(i);
  return out;
}

export function findLast(sorted: Match[]): number | null {
  for (let i = sorted.length - 1; i >= 0; i--) if (isFinished(sorted[i])) return i;
  return null;
}
