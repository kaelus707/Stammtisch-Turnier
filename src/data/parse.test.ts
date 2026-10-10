import { describe, expect, it } from 'vitest';
import { parseTournament, type RawSheets } from './parse';

const csv = (rows: (string | number)[][]) =>
  rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');

const groupCsv = (g: string, teams: string[], hint = '') =>
  csv([
    ['Platz', 'Code', 'Team', 'Sp', 'S', 'U', 'N', 'Tore', 'Gegentore', 'Diff', 'Pkt', 'Hinweis'],
    ...teams.map((t, i) => [String(i + 1), `${g}${i + 1}`, t, '1', i === 0 ? '1' : '0', '0', i === 0 ? '0' : '1', i === 0 ? '2' : '1', i === 0 ? '1' : '2', i === 0 ? '1' : '-1', i === 0 ? '3' : '0', hint]),
  ]);

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
    ['Code', 'Team', 'Gruppe', 'Los'],
    ['A1', 'Rot', 'A', ''],
    ['A2', 'Blau', 'A', '1'],
    ['B1', 'Grün', 'B', ''],
    ['B2', 'Gelb', 'B', ''],
  ]),
  Spielplan: csv([
    ['Nr.', 'Phase', 'Zeit', 'Runde', 'Code A', 'Team A', 'Code B', 'Team B', 'Tore A', 'Tore B', 'Sieger', 'Sieger-Code', 'Verlierer-Code'],
    ['1', 'Gruppenphase', '14:00', 'Gruppe A', 'A1', 'Rot', 'A2', 'Blau', '2', '1', 'Rot', 'A1', 'A2'],
    ['2', 'Gruppenphase', '14:12', 'Gruppe B', 'B1', 'Grün', 'B2', 'Gelb', '', '', '', '', ''],
    ['3', 'Halbfinale', '14:24', 'Halbfinale 1', 'A1', 'Rot', '', '2. Gr. B', '', '', '', '', ''],
  ]),
  Spieler: csv([
    ['Name', 'Team', 'Tore'],
    ['Max', 'Rot', '2'],
    ['Moritz', 'Blau', ''],
  ]),
  'Gruppe A': groupCsv('A', ['Rot', 'Blau']),
  'Gruppe B': groupCsv('B', ['Grün', 'Gelb']),
  Endplatzierung: csv([['Platz', 'Team', 'Gruppe', 'Herkunft'], ['1', 'Rot', 'A', 'Sieger Finale'], ['2', '', '', 'Verlierer Finale']]),
});

describe('parseTournament', () => {
  it('liest gültige Daten ohne Warnungen', () => {
    const { data, warnings } = parseTournament(base());
    expect(warnings).toEqual([]);
    expect(data.settings).toEqual({
      name: 'Test-Turnier', date: '14.11.2026', startMinutes: 840, matchMinutes: 10, breakMinutes: 2,
    });
    expect(data.teams).toEqual([
      { name: 'Rot', group: 'A' }, { name: 'Blau', group: 'A' }, { name: 'Grün', group: 'B' }, { name: 'Gelb', group: 'B' },
    ]);
    expect(data.matches[0]).toEqual({
      nr: 1, round: 'Gruppe A', group: 'A', home: 'Rot', away: 'Blau', homeGoals: 2, awayGoals: 1,
      homeSide: { team: 'Rot', label: 'Rot' }, awaySide: { team: 'Blau', label: 'Blau' },
      winner: 'Rot', loser: 'Blau', undecided: false,
    });
    expect(data.matches[2]).toMatchObject({
      nr: 3, group: null, homeSide: { team: 'Rot', label: 'Rot' }, awaySide: { team: null, label: '2. Gr. B' }, winner: null,
    });
    expect(data.tables[0]).toEqual({
      group: 'A', complete: true,
      rows: [
        { rank: 1, team: 'Rot', played: 1, won: 1, drawn: 0, lost: 0, goalsFor: 2, goalsAgainst: 1, diff: 1, points: 3, lotPending: false },
        { rank: 2, team: 'Blau', played: 1, won: 0, drawn: 0, lost: 1, goalsFor: 1, goalsAgainst: 2, diff: -1, points: 0, lotPending: false },
      ],
    });
    expect(data.ranking).toEqual(['Rot', null]);
    expect(data.players).toEqual([
      { name: 'Max', team: 'Rot', goals: 2 },
      { name: 'Moritz', team: 'Blau', goals: 0 },
    ]);
  });

  it('übernimmt „Los ausstehend“ und erkennt unvollständige Gruppen', () => {
    const raw = { ...base(), 'Gruppe B': groupCsv('B', ['Grün', 'Gelb'], 'Los ausstehend') };
    const t = parseTournament(raw).data.tables[1];
    expect(t.rows.every((r) => r.lotPending)).toBe(true);
    const open = { ...base(), 'Gruppe A': groupCsv('A', ['Rot', 'Blau']).replace(/"1","A1","Rot","1"/, '"1","A1","Rot","0"') };
    expect(parseTournament(open).data.tables[0].complete).toBe(false);
  });

  it('meldet ein Unentschieden im K.-o.-Spiel als unbestimmt', () => {
    const raw = { ...base(), Spielplan: base().Spielplan.replace('"Rot","","2. Gr. B","","",""', '"Rot","B2","Gelb","3","3","Unentschieden"') };
    expect(parseTournament(raw).data.matches[2]).toMatchObject({ winner: null, loser: null, undecided: true });
  });

  it('verwirft Tabellenzeilen mit ungültigen Zahlen', () => {
    const raw = { ...base(), 'Gruppe A': groupCsv('A', ['Rot', 'Blau']).replace('"-1"', '"x"') };
    const { data, warnings } = parseTournament(raw);
    expect(data.tables[0].rows.map((r) => r.team)).toEqual(['Rot']);
    expect(warnings).toContain('Gruppe A: Zeile „Blau“ enthält ungültige Zahlen, ignoriert.');
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
    const raw = { ...base(), Teams: csv([['Code', 'Team', 'Gruppe', 'Los'], ['A1', 'Rot', 'A', ''], ['A2', 'Rot', 'B', ''], ['A3', 'Lila', 'C', '']]) };
    const { data, warnings } = parseTournament(raw);
    expect(data.teams.map((t) => t.name)).toEqual(['Rot']);
    expect(warnings).toContain('Team „Rot“ ist doppelt eingetragen.');
    expect(warnings).toContain('Team „Lila“: Gruppe „C“ ist ungültig (A oder B).');
  });

  it('verwirft Spiele mit unbekanntem Team und doppelter Nr.', () => {
    const raw = {
      ...base(),
      Spielplan: csv([
        ['Nr.', 'Runde', 'Team A', 'Team B', 'Tore A', 'Tore B', 'Sieger'],
        ['1', 'Gruppe A', 'Rot', 'Pink', '', '', ''],
        ['2', 'Gruppe A', 'Rot', 'Blau', '', '', ''],
        ['2', 'Gruppe B', 'Grün', 'Gelb', '', '', ''],
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
});
