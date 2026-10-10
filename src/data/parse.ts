import Papa from 'papaparse';
import type { Group, GroupTable, Player, ResolvedMatch, Settings, Side, StandingRow, Team, TournamentData } from '../domain/types';

export const SHEET_NAMES = ['Einstellungen', 'Teams', 'Spielplan', 'Spieler', 'Gruppe A', 'Gruppe B', 'Endplatzierung'] as const;
export type SheetName = (typeof SHEET_NAMES)[number];
export type RawSheets = Record<SheetName, string>;

/** Nur die Anzeige-Bereiche lesen – die Rechenhilfe darunter würde die gviz-Typerkennung stören */
export const SHEET_RANGES: Partial<Record<SheetName, string>> = { 'Gruppe A': 'A1:L6', 'Gruppe B': 'A1:L6', Endplatzierung: 'A1:D11' };

type Row = Record<string, string>;

// gviz exportiert Ganzzahlen gelegentlich als "3.0"
const int = (s: string): number | null => (/^\d+(\.0+)?$/.test(s) ? parseInt(s, 10) : null);
const signedInt = (s: string): number | null => (/^-?\d+(\.0+)?$/.test(s) ? parseInt(s, 10) : null);

function parseTime(s: string): number | null {
  const m = /^(\d{1,2}):(\d{2})(:\d{2})?$/.exec(s);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  return h < 24 && min < 60 ? h * 60 + min : null;
}

function table(csv: string, sheet: SheetName, required: string[], w: string[]): Row[] {
  const { data } = Papa.parse<string[]>(csv.trim(), { skipEmptyLines: 'greedy' });
  if (data.length === 0) {
    w.push(`Blatt „${sheet}“ ist leer.`);
    return [];
  }
  const header = data[0].map((h) => h.replace(/^﻿/, '').trim());
  const missing = required.filter((r) => !header.includes(r));
  if (missing.length) {
    w.push(`Blatt „${sheet}“: Spalten fehlen: ${missing.map((m) => `„${m}“`).join(', ')}.`);
    return [];
  }
  return data.slice(1).map((cells) => Object.fromEntries(header.map((h, i) => [h, (cells[i] ?? '').trim()])));
}

function parseSettings(rows: Row[], w: string[]): Settings {
  const get = (k: string) => rows.find((r) => r['Feld'] === k)?.['Wert'] ?? '';
  const name = get('Turniername');
  if (!name) w.push('Einstellung „Turniername“ fehlt.');
  const date = get('Datum');
  if (!date) w.push('Einstellung „Datum“ fehlt.');
  const startMinutes = parseTime(get('Startzeit'));
  if (startMinutes === null) w.push('Einstellung „Startzeit“ fehlt oder ist ungültig (Format HH:MM).');
  const matchMinutes = int(get('Spieldauer (Min.)'));
  if (matchMinutes === null) w.push('Einstellung „Spieldauer (Min.)“ fehlt oder ist ungültig.');
  const rawBreak = get('Pause (Min.)');
  const breakMinutes = rawBreak === '' ? 2 : int(rawBreak);
  if (breakMinutes === null) w.push('Einstellung „Pause (Min.)“ ist ungültig, verwende 2.');
  return { name: name || 'Stammtischturnier', date, startMinutes, matchMinutes, breakMinutes: breakMinutes ?? 2 };
}

function parseTeams(rows: Row[], w: string[]): Team[] {
  const teams: Team[] = [];
  for (const r of rows) {
    const name = r['Team'];
    if (!name) continue;
    const group = r['Gruppe'].toUpperCase();
    if (group !== 'A' && group !== 'B') {
      w.push(`Team „${name}“: Gruppe „${r['Gruppe']}“ ist ungültig (A oder B).`);
      continue;
    }
    if (teams.some((t) => t.name === name)) {
      w.push(`Team „${name}“ ist doppelt eingetragen.`);
      continue;
    }
    teams.push({ name, group });
  }
  return teams;
}

function parseMatches(rows: Row[], teams: Team[], w: string[]): ResolvedMatch[] {
  const names = new Set(teams.map((t) => t.name));
  const side = (s: string): Side => ({ team: names.has(s) ? s : null, label: s });
  const matches: ResolvedMatch[] = [];
  for (const r of rows) {
    const nr = int(r['Nr.']);
    if (nr === null) {
      if (Object.values(r).some(Boolean)) w.push(`Spielplan: Zeile ohne gültige Nr. ignoriert.`);
      continue;
    }
    if (matches.some((m) => m.nr === nr)) {
      w.push(`Spiel ${nr}: Nr. doppelt, Zeile ignoriert.`);
      continue;
    }
    const g = /^Gruppe ([AB])$/i.exec(r['Runde']);
    const group = g ? (g[1].toUpperCase() as Group) : null;
    const home = r['Team A'];
    const away = r['Team B'];
    const bad = group
      ? [home, away].find((s) => !teams.some((t) => t.name === s && t.group === group))
      : [home, away].find((s) => s === '');
    if (bad !== undefined) {
      w.push(`Spiel ${nr}: Team „${bad}“ ist unbekannt${group ? ` in Gruppe ${group}` : ''}, Zeile ignoriert.`);
      continue;
    }
    const goals = (s: string): number | null => {
      if (s === '') return null;
      const n = int(s);
      if (n === null) w.push(`Spiel ${nr}: Tore „${s}“ ungültig, ignoriert.`);
      return n;
    };
    const homeGoals = goals(r['Tore A']);
    const awayGoals = goals(r['Tore B']);
    const homeSide = side(home);
    const awaySide = side(away);
    const winner = names.has(r['Sieger']) ? r['Sieger'] : null;
    const loser = winner === null ? null : winner === homeSide.team ? awaySide.team : homeSide.team;
    const finished = homeGoals !== null && awayGoals !== null;
    matches.push({
      nr, round: r['Runde'], group, home, away, homeGoals, awayGoals, homeSide, awaySide, winner, loser,
      undecided: group === null && finished && r['Sieger'] === 'Unentschieden',
    });
  }
  return matches;
}

function parseGroup(rows: Row[], group: Group, w: string[]): GroupTable {
  const out: StandingRow[] = [];
  for (const r of rows) {
    const team = r['Team'];
    if (!team) continue;
    const n = ['Platz', 'Sp', 'S', 'U', 'N', 'Tore', 'Gegentore', 'Diff', 'Pkt'].map((k) => signedInt(r[k]));
    if (n.some((x) => x === null)) {
      w.push(`Gruppe ${group}: Zeile „${team}“ enthält ungültige Zahlen, ignoriert.`);
      continue;
    }
    const [rank, played, won, drawn, lost, goalsFor, goalsAgainst, diff, points] = n as number[];
    out.push({ rank, team, played, won, drawn, lost, goalsFor, goalsAgainst, diff, points, lotPending: r['Hinweis'] === 'Los ausstehend' });
  }
  return { group, rows: out, complete: out.length > 0 && out.every((x) => x.played === out.length - 1) };
}

function parseRanking(rows: Row[]): (string | null)[] {
  const ranking: (string | null)[] = [];
  for (const r of rows) {
    const p = int(r['Platz']);
    if (p !== null && p > 0) ranking[p - 1] = r['Team'] || null;
  }
  return Array.from(ranking, (t) => t ?? null);
}

function parsePlayers(rows: Row[], teams: Team[], w: string[]): Player[] {
  const players: Player[] = [];
  for (const r of rows) {
    const name = r['Name'];
    if (!name) continue;
    const team = r['Team'];
    if (team && !teams.some((t) => t.name === team)) w.push(`Spieler „${name}“: Team „${team}“ ist unbekannt.`);
    const raw = r['Tore'];
    const goals = raw === '' ? 0 : int(raw);
    if (goals === null) w.push(`Spieler „${name}“: Tore „${raw}“ ungültig, zähle 0.`);
    players.push({ name, team, goals: goals ?? 0 });
  }
  return players;
}

export function parseTournament(raw: RawSheets): { data: TournamentData; warnings: string[] } {
  const w: string[] = [];
  const settings = parseSettings(table(raw.Einstellungen, 'Einstellungen', ['Feld', 'Wert'], w), w);
  const teams = parseTeams(table(raw.Teams, 'Teams', ['Team', 'Gruppe'], w), w);
  const matches = parseMatches(
    table(raw.Spielplan, 'Spielplan', ['Nr.', 'Runde', 'Team A', 'Team B', 'Tore A', 'Tore B', 'Sieger'], w), teams, w,
  );
  const players = parsePlayers(table(raw.Spieler, 'Spieler', ['Name', 'Team', 'Tore'], w), teams, w);
  const groupCols = ['Platz', 'Team', 'Sp', 'S', 'U', 'N', 'Tore', 'Gegentore', 'Diff', 'Pkt', 'Hinweis'];
  const tables = (['A', 'B'] as const).map((g) => parseGroup(table(raw[`Gruppe ${g}`], `Gruppe ${g}`, groupCols, w), g, w));
  const ranking = parseRanking(table(raw.Endplatzierung, 'Endplatzierung', ['Platz', 'Team'], w));
  return { data: { settings, teams, matches, players, tables, ranking }, warnings: w };
}
