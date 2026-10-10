import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseTournament, SHEET_NAMES } from '../src/data/parse.ts';
import { buildSnapshot } from '../src/domain/snapshot.ts';
import { demoWorkbook, toCsvs } from './demo.ts';

describe('Demo-Daten', () => {
  it('sind aktuell (npm run demo nach Änderungen an Vorlage oder Demo)', () => {
    const csvs = toCsvs(demoWorkbook());
    for (const s of SHEET_NAMES) {
      // git kann unter Windows CRLF auschecken
      expect(readFileSync(new URL(`../public/demo/${s}.csv`, import.meta.url), 'utf8').replace(/\r\n/g, '\n'), s).toBe(csvs[s]);
    }
  });

  it('ergeben einen stimmigen Zwischenstand ohne Warnungen', () => {
    const { data, warnings } = parseTournament(toCsvs(demoWorkbook()));
    expect(warnings).toEqual([]);
    const s = buildSnapshot(data, warnings);
    expect(data.teams).toHaveLength(10);
    expect(data.players).toHaveLength(10);
    expect(s.matches).toHaveLength(27);
    expect(s.liveIndex).toBe(11);
    expect(s.matches[11]).toMatchObject({ nr: 12, startMinutes: 840 + 11 * 12 });
    expect(s.tables[0].rows[0].team).toBe('FC Bierbauch');
    expect(s.tables[1].rows[0].team).toBe('Trachtler');
    expect(s.matches[21].homeSide).toEqual({ team: null, label: '1. Gr. A' });
    expect(s.champion).toBeNull();
  });

  it('rechnet ein komplettes Turnier mit eigenen Teamnamen bis zum Sieger durch', () => {
    const wb = demoWorkbook();
    const plan = wb.getWorksheet('Spielplan')!;
    // Los für alle, damit kein Gleichstand die K.-o.-Runde blockiert
    for (let r = 2; r <= 11; r++) wb.getWorksheet('Teams')!.getCell(`D${r}`).value = r - 1;
    // Restliche Gruppenspiele 0:1, K.-o. alle 1:0 für Team A
    for (let r = 13; r <= 21; r++) [plan.getCell(`I${r}`).value, plan.getCell(`J${r}`).value] = [0, 1];
    for (let r = 22; r <= 28; r++) [plan.getCell(`I${r}`).value, plan.getCell(`J${r}`).value] = [1, 0];
    const { data, warnings } = parseTournament(toCsvs(wb));
    const s = buildSnapshot(data, warnings);
    expect(warnings).toEqual([]);
    expect(s.liveIndex).toBeNull();
    expect(s.ranking.every((t) => t !== null)).toBe(true);
    expect(new Set(s.ranking).size).toBe(10);
    expect(s.champion).toBe(s.ranking[0]);
    expect(s.matches[26].winner).toBe(s.champion);
    expect(s.rest.every((r) => r.status === 'done' && r.place !== null)).toBe(true);
  });
});
