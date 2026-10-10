export type Group = 'A' | 'B';
/** Team aus Blatt Teams, i = Index 0–4 in der Gruppe */
export type Slot = { group: Group; i: number };
/** Platz 1–5 der Gruppen-Endtabelle */
export type GroupPlace = { group: Group; place: number };
export type SemiResult = { result: 'Sieger' | 'Verlierer'; semi: 1 | 2 };
export type PlanSide = Slot | GroupPlace | SemiResult;

export interface PlanRow {
  nr: number;
  phase: string;
  round: string;
  home: PlanSide;
  away: PlanSide;
}

/** Reihenfolge in einer 5er-Gruppe: jedes Paar genau einmal, aufeinanderfolgende Spiele ohne gemeinsames Team. */
export const GROUP_ORDER: [number, number][] = [
  [0, 1], [2, 3], [0, 4], [1, 2], [3, 4],
  [0, 2], [1, 3], [2, 4], [0, 3], [1, 4],
];

const gp = (group: Group, place: number): GroupPlace => ({ group, place });

export const KNOCKOUT: [phase: string, round: string, home: PlanSide, away: PlanSide][] = [
  ['Platzierungsspiel', 'Spiel um Platz 9', gp('A', 5), gp('B', 5)],
  ['Halbfinale', 'Halbfinale 1', gp('A', 1), gp('B', 2)],
  ['Platzierungsspiel', 'Spiel um Platz 7', gp('A', 4), gp('B', 4)],
  ['Halbfinale', 'Halbfinale 2', gp('A', 2), gp('B', 1)],
  ['Platzierungsspiel', 'Spiel um Platz 5', gp('A', 3), gp('B', 3)],
  ['Platzierungsspiel', 'Spiel um Platz 3', { result: 'Verlierer', semi: 1 }, { result: 'Verlierer', semi: 2 }],
  ['Finale', 'Finale', { result: 'Sieger', semi: 1 }, { result: 'Sieger', semi: 2 }],
];

export const sideLabel = (s: PlanSide): string =>
  'i' in s ? `${s.group}${s.i + 1}` : 'place' in s ? `${s.place}. Gr. ${s.group}` : `${s.result} HF${s.semi}`;

export function planRows(): PlanRow[] {
  const rows: PlanRow[] = [];
  for (const [h, a] of GROUP_ORDER) {
    for (const group of ['A', 'B'] as const) {
      rows.push({ nr: rows.length + 1, phase: 'Gruppenphase', round: `Gruppe ${group}`, home: { group, i: h }, away: { group, i: a } });
    }
  }
  for (const [phase, round, home, away] of KNOCKOUT) rows.push({ nr: rows.length + 1, phase, round, home, away });
  return rows;
}
