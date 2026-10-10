import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseTournament, SHEET_NAMES, type RawSheets } from './parse';

const csv = (rows: (string | number)[][]) =>
  rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');

const base = (): RawSheets => ({
  Einstellungen: csv([
    ['Feld', 'Wert'],
    ['Turniername', 'Test-Turnier'],
    ['Datum', '14.11.2026'],
    ['Startzeit', '14:00'],
    ['Spieldauer (Min.)', '10'],
    ['Pause (Min.)', '2'],
  ]),
  Teams: csv([
    ['Team', 'Gruppe', 'Los'],
    ['Rot', 'A', ''],
    ['Blau', 'A', '1'],
    ['Grün', 'B', ''],
    ['Gelb', 'B', ''],
  ]),
  Spielplan: csv([
    ['Nr.', 'Runde', 'Heim', 'Gast', 'Tore Heim', 'Tore Gast'],
    ['1', 'Gruppe A', 'Rot', 'Blau', '2', '1'],
    ['2', 'Gruppe B', 'Grün', 'Gelb', '', ''],
    ['3', 'Halbfinale 1', 'A1', 'B2', '', ''],
  ]),
  Spieler: csv([
    ['Name', 'Team', 'Tore'],
    ['Max', 'Rot', '2'],
    ['Moritz', 'Blau', ''],
  ]),
});

describe('parseTournament', () => {
  it('liest gültige Daten ohne Warnungen', () => {
    const { data, warnings } = parseTournament(base());
    expect(warnings).toEqual([]);
    expect(data.settings).toEqual({
      name: 'Test-Turnier', date: '14.11.2026', startMinutes: 840, matchMinutes: 10, breakMinutes: 2,
    });
    expect(data.teams).toEqual([
      { name: 'Rot', group: 'A', lot: null },
      { name: 'Blau', group: 'A', lot: 1 },
      { name: 'Grün', group: 'B', lot: null },
      { name: 'Gelb', group: 'B', lot: null },
    ]);
    expect(data.matches[0]).toEqual({
      nr: 1, round: 'Gruppe A', group: 'A', home: 'Rot', away: 'Blau', homeGoals: 2, awayGoals: 1,
    });
    expect(data.matches[2]).toMatchObject({ nr: 3, group: null, home: 'A1', away: 'B2', homeGoals: null });
    expect(data.players).toEqual([
      { name: 'Max', team: 'Rot', goals: 2 },
      { name: 'Moritz', team: 'Blau', goals: 0 },
    ]);
  });

  it('akzeptiert Startzeit mit Sekunden', () => {
    const raw = { ...base(), Einstellungen: base().Einstellungen.replace('"14:00"', '"14:30:00"') };
    expect(parseTournament(raw).data.settings.startMinutes).toBe(870);
  });

  it('warnt bei fehlender Startzeit und setzt null', () => {
    const raw = { ...base(), Einstellungen: base().Einstellungen.replace('"14:00"', '""') };
    const { data, warnings } = parseTournament(raw);
    expect(data.settings.startMinutes).toBeNull();
    expect(warnings).toContain('Einstellung „Startzeit“ fehlt oder ist ungültig (Format HH:MM).');
  });

  it('nimmt 2 Minuten Pause, wenn das Feld leer ist', () => {
    const raw = { ...base(), Einstellungen: base().Einstellungen.replace('"Pause (Min.)","2"', '"Pause (Min.)",""') };
    const { data, warnings } = parseTournament(raw);
    expect(data.settings.breakMinutes).toBe(2);
    expect(warnings).toEqual([]);
  });

  it('verwirft Teams mit ungültiger Gruppe oder doppeltem Namen', () => {
    const raw = { ...base(), Teams: csv([['Team', 'Gruppe', 'Los'], ['Rot', 'A', ''], ['Rot', 'B', ''], ['Lila', 'C', '']]) };
    const { data, warnings } = parseTournament(raw);
    expect(data.teams.map((t) => t.name)).toEqual(['Rot']);
    expect(warnings).toContain('Team „Rot“ ist doppelt eingetragen.');
    expect(warnings).toContain('Team „Lila“: Gruppe „C“ ist ungültig (A oder B).');
  });

  it('verwirft Spiele mit unbekanntem Team und doppelter Nr.', () => {
    const raw = {
      ...base(),
      Spielplan: csv([
        ['Nr.', 'Runde', 'Heim', 'Gast', 'Tore Heim', 'Tore Gast'],
        ['1', 'Gruppe A', 'Rot', 'Pink', '', ''],
        ['2', 'Gruppe A', 'Rot', 'Blau', '', ''],
        ['2', 'Gruppe B', 'Grün', 'Gelb', '', ''],
      ]),
    };
    const { data, warnings } = parseTournament(raw);
    expect(data.matches.map((m) => m.nr)).toEqual([2]);
    expect(warnings).toContain('Spiel 1: Team „Pink“ ist unbekannt in Gruppe A, Zeile ignoriert.');
    expect(warnings).toContain('Spiel 2: Nr. doppelt, Zeile ignoriert.');
  });

  it('ignoriert ungültige Tore mit Warnung', () => {
    const raw = { ...base(), Spielplan: base().Spielplan.replace('"2","1"', '"x","1"') };
    const { data, warnings } = parseTournament(raw);
    expect(data.matches[0].homeGoals).toBeNull();
    expect(warnings).toContain('Spiel 1: Tore „x“ ungültig, ignoriert.');
  });

  it('wertet ein halb eingetragenes Ergebnis ohne Warnung als offen', () => {
    const raw = { ...base(), Spielplan: base().Spielplan.replace('"2","1"', '"2",""') };
    const { data, warnings } = parseTournament(raw);
    expect(data.matches[0]).toMatchObject({ homeGoals: 2, awayGoals: null });
    expect(warnings).toEqual([]);
  });

  it('warnt, wenn statt eines Blatts ein anderes geliefert wird', () => {
    // gviz liefert bei unbekanntem Blattnamen still das erste Blatt
    const raw = { ...base(), Teams: base().Einstellungen };
    const { data, warnings } = parseTournament(raw);
    expect(data.teams).toEqual([]);
    expect(warnings).toContain('Blatt „Teams“: Spalten fehlen: „Team“, „Gruppe“.');
  });

  it('warnt bei leerem Blatt', () => {
    const { warnings } = parseTournament({ ...base(), Spieler: '' });
    expect(warnings).toContain('Blatt „Spieler“ ist leer.');
  });

  it('parst die Demo-Dateien ohne Warnungen', () => {
    const raw = Object.fromEntries(
      SHEET_NAMES.map((s) => [s, readFileSync(new URL(`../../public/demo/${s}.csv`, import.meta.url), 'utf8')]),
    ) as RawSheets;
    const { data, warnings } = parseTournament(raw);
    expect(warnings).toEqual([]);
    expect(data.teams).toHaveLength(10);
    expect(data.matches).toHaveLength(27);
    expect(data.matches.filter((m) => m.homeGoals !== null && m.awayGoals !== null)).toHaveLength(11);
    expect(data.players).toHaveLength(10);
  });
});
