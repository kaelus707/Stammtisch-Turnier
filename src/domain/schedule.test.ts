import { describe, expect, it } from 'vitest';
import { m, settings } from './fixtures';
import { findLast, findLive, findNext, formatTime, plannedStart, sortByNr } from './schedule';

describe('schedule', () => {
  it('sortiert nach Nr.', () => {
    expect(sortByNr([m(3, 'a', 'b'), m(1, 'c', 'd'), m(2, 'e', 'f')]).map((x) => x.nr)).toEqual([1, 2, 3]);
  });

  it('berechnet die geplante Uhrzeit aus Start, Spieldauer und Pause', () => {
    expect(plannedStart(0, settings())).toBe(840);
    expect(formatTime(plannedStart(2, settings()))).toBe('14:24');
  });

  it('liefert null, wenn Startzeit oder Spieldauer fehlt', () => {
    expect(plannedStart(1, settings({ startMinutes: null }))).toBeNull();
    expect(plannedStart(1, settings({ matchMinutes: null }))).toBeNull();
    expect(formatTime(null)).toBe('–');
  });

  it('formatiert über Mitternacht hinaus', () => {
    expect(formatTime(24 * 60 + 10)).toBe('00:10');
  });

  it('nimmt das erste Spiel ohne Ergebnis als Live-Spiel, auch wenn später schon Ergebnisse stehen', () => {
    const ms = [m(1, 'a', 'b', [1, 0]), m(2, 'c', 'd'), m(3, 'e', 'f', [2, 2]), m(4, 'g', 'h'), m(5, 'i', 'j')];
    expect(findLive(ms)).toBe(1);
    expect(findNext(ms, 1)).toEqual([3, 4]);
    expect(findLast(ms)).toBe(2);
  });

  it('wertet halb eingetragene Ergebnisse als offen', () => {
    const half = { ...m(1, 'a', 'b'), homeGoals: 3 };
    expect(findLive([half])).toBe(0);
  });

  it('meldet Turnierende, wenn alle Spiele ein Ergebnis haben', () => {
    const ms = [m(1, 'a', 'b', [1, 0])];
    expect(findLive(ms)).toBeNull();
    expect(findNext(ms, null)).toEqual([]);
    expect(findLast([m(1, 'a', 'b')])).toBeNull();
  });
});
