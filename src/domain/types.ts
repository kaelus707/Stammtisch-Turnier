export type Group = 'A' | 'B';

export interface Settings {
  name: string;
  date: string;
  /** Minuten seit Mitternacht; null, wenn fehlend oder ungültig */
  startMinutes: number | null;
  matchMinutes: number | null;
  breakMinutes: number;
}

export interface Team {
  name: string;
  group: Group;
}

export interface Match {
  nr: number;
  round: string;
  /** 'A'/'B' bei Gruppenspielen, null bei Finalrundenspielen */
  group: Group | null;
  /** Text aus Spalte Team A/B: Teamname oder Platzhalter wie '1. Gr. A', 'Sieger HF1' */
  home: string;
  away: string;
  homeGoals: number | null;
  awayGoals: number | null;
}

export interface Player {
  name: string;
  team: string;
  goals: number;
}

export interface TournamentData {
  settings: Settings;
  teams: Team[];
  /** von der Tabelle fertig aufgelöst */
  matches: ResolvedMatch[];
  players: Player[];
  tables: GroupTable[];
  /** Index 0 = Platz 1; null = noch offen */
  ranking: (string | null)[];
}

export interface StandingRow {
  rank: number;
  team: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  diff: number;
  points: number;
  /** nach allen Kriterien gleich und Los fehlt */
  lotPending: boolean;
}

export interface GroupTable {
  group: Group;
  rows: StandingRow[];
  /** alle Gruppenspiele haben ein Ergebnis */
  complete: boolean;
}

/** Eine Seite einer Paarung: team = aufgelöster Teamname oder null, label = Anzeige */
export interface Side {
  team: string | null;
  label: string;
}

export interface ResolvedMatch extends Match {
  homeSide: Side;
  awaySide: Side;
  winner: string | null;
  loser: string | null;
  /** K.-o.-Spiel beendet, aber unentschieden */
  undecided: boolean;
}

export interface ScheduledMatch extends ResolvedMatch {
  /** Position in der nach Nr. sortierten Liste, ab 0 */
  index: number;
  startMinutes: number | null;
  finished: boolean;
}

export type RestStatus = 'playing' | 'next' | 'resting' | 'waiting' | 'done';

export interface RestEntry {
  team: string;
  status: RestStatus;
  /** Anzahl Spiele Pause bis zum nächsten eigenen Spiel (nur bei 'resting' > 0) */
  gap: number;
  matchIndex: number | null;
  /** Spielnummer des nächsten eigenen Spiels */
  nextNr: number | null;
  /** Endplatz, falls bekannt (nur bei 'done') */
  place: number | null;
}

export interface ScorerRow {
  rank: number;
  name: string;
  team: string;
  goals: number;
}

export interface Snapshot {
  settings: Settings;
  tables: GroupTable[];
  matches: ScheduledMatch[];
  liveIndex: number | null;
  nextIndices: number[];
  lastIndex: number | null;
  rest: RestEntry[];
  scorers: ScorerRow[];
  /** Index 0 = Platz 1; null = noch offen */
  ranking: (string | null)[];
  champion: string | null;
  warnings: string[];
}

export const isFinished = (m: Pick<Match, 'homeGoals' | 'awayGoals'>): boolean =>
  m.homeGoals !== null && m.awayGoals !== null;
