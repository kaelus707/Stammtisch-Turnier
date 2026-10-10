import Papa from 'papaparse';
import type { Group, Match, Player, Settings, Team, TournamentData } from '../domain/types';

export const SHEET_NAMES = ['Einstellungen', 'Teams', 'Spielplan', 'Spieler'] as const;
export type SheetName = (typeof SHEET_NAMES)[number];
export type RawSheets = Record<SheetName, string>;

type Row = Record<string, string>;

const PLACEHOLDER = /^([AB][1-5]|(Sieger|Verlierer) HF[12])$/;
export const isPlaceholder = (s: string): boolean => PLACEHOLDER.test(s);

// gviz exportiert Ganzzahlen gelegentlich als "3.0"
const int = (s: string): number | null => (/^\d+(\.0+)?$/.test(s) ? parseInt(s, 10) : null);

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
    const rawLot = r['Los'] ?? '';
    const lot = rawLot === '' ? null : int(rawLot);
    if (rawLot !== '' && lot === null) w.push(`Team „${name}“: Los „${rawLot}“ ist keine Ganzzahl.`);
    teams.push({ name, group, lot });
  }
  return teams;
}

function parseMatches(rows: Row[], teams: Team[], w: string[]): Match[] {
  const matches: Match[] = [];
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
    const known = (s: string) =>
      group ? teams.some((t) => t.name === s && t.group === group) : isPlaceholder(s) || teams.some((t) => t.name === s);
    const bad = [r['Heim'], r['Gast']].find((s) => !known(s));
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
    matches.push({
      nr, round: r['Runde'], group, home: r['Heim'], away: r['Gast'],
      homeGoals: goals(r['Tore Heim']), awayGoals: goals(r['Tore Gast']),
    });
  }
  return matches;
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
    table(raw.Spielplan, 'Spielplan', ['Nr.', 'Runde', 'Heim', 'Gast', 'Tore Heim', 'Tore Gast'], w), teams, w,
  );
  const players = parsePlayers(table(raw.Spieler, 'Spieler', ['Name', 'Team', 'Tore'], w), teams, w);
  return { data: { settings, teams, matches, players }, warnings: w };
}
