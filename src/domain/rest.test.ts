import { describe, expect, it } from 'vitest';
import { scheduled, team } from './fixtures';
import { restLabel, restOverview } from './rest';
import type { RestEntry } from './types';

const teams = ['a', 'b', 'c', 'd', 'e', 'f'].map((n) => team(n, 'A'));

describe('restOverview', () => {
  const matches = [
    scheduled(0, 'a', 'b', true),
    scheduled(1, 'c', 'd'),
    scheduled(2, 'a', 'e'),
    scheduled(3, 'b', 'f'),
    scheduled(4, 'c', 'b'),
  ];
  const rest = restOverview(teams, matches, 1, Array(6).fill(null));
  const by = (n: string) => rest.find((r) => r.team === n)!;

  it('erkennt spielt jetzt, nächstes Spiel und Pause mit Anzahl und Spielnummer', () => {
    expect(by('c')).toMatchObject({ status: 'playing', matchIndex: 1 });
    expect(by('a')).toMatchObject({ status: 'next', matchIndex: 2 });
    expect(by('b')).toMatchObject({ status: 'resting', gap: 1, matchIndex: 3, nextNr: 4 });
  });

  it('sortiert aufsteigend nach dem nächsten Spiel, alphabetisch bei Gleichstand', () => {
    expect(rest.map((r) => r.team)).toEqual(['c', 'd', 'a', 'e', 'b', 'f']);
  });

  it('meldet „wartet auf Finalrunde“, solange Platzhalter offen sind', () => {
    const r = restOverview(teams, [scheduled(0, 'a', 'b', true), scheduled(1, null, null)], 1, Array(6).fill(null));
    expect(r.find((x) => x.team === 'a')!.status).toBe('waiting');
  });

  it('meldet „fertig“ mit Endplatz, auch wenn andere noch warten', () => {
    const ranking = [null, null, null, null, 'a', 'b'];
    const r = restOverview(teams, [scheduled(0, 'a', 'b', true), scheduled(1, null, null)], 1, ranking);
    expect(r.find((x) => x.team === 'a')).toMatchObject({ status: 'done', place: 5 });
    expect(r.at(-1)!.status).toBe('done');
  });

  it('meldet „fertig“ ohne Platz, wenn nichts mehr offen ist', () => {
    const r = restOverview(teams, [scheduled(0, 'a', 'b', true)], null, Array(6).fill(null));
    expect(r.every((x) => x.status === 'done' && x.place === null)).toBe(true);
  });
});

describe('restLabel', () => {
  const e = (over: Partial<RestEntry>): RestEntry => ({
    team: 't', status: 'resting', gap: 0, matchIndex: null, nextNr: null, place: null, ...over,
  });

  it('formuliert die Texte laut Spec', () => {
    expect(restLabel(e({ status: 'playing' }))).toBe('spielt jetzt');
    expect(restLabel(e({ status: 'next' }))).toBe('nächstes Spiel');
    expect(restLabel(e({ gap: 1, nextNr: 4 }))).toBe('noch 1 Spiel Pause · Spiel 4');
    expect(restLabel(e({ gap: 3, nextNr: 6 }))).toBe('noch 3 Spiele Pause · Spiel 6');
    expect(restLabel(e({ gap: 2 }))).toBe('noch 2 Spiele Pause');
    expect(restLabel(e({ status: 'waiting' }))).toBe('wartet auf Finalrunde');
    expect(restLabel(e({ status: 'done', place: 3 }))).toBe('fertig · Platz 3');
    expect(restLabel(e({ status: 'done' }))).toBe('fertig');
  });
});
