export type Slot = { group: 'A' | 'B'; i: number };

export interface PlanRow {
  nr: number;
  round: string;
  /** Slot = Team aus Blatt Teams (Index 0–4 in der Gruppe), string = Platzhalter */
  home: Slot | string;
  away: Slot | string;
}

/** Reihenfolge in einer 5er-Gruppe: jedes Paar genau einmal, aufeinanderfolgende Spiele ohne gemeinsames Team. */
export const GROUP_ORDER: [number, number][] = [
  [0, 1], [2, 3], [0, 4], [1, 2], [3, 4],
  [0, 2], [1, 3], [2, 4], [0, 3], [1, 4],
];

export const KNOCKOUT: [round: string, home: string, away: string][] = [
  ['Spiel um Platz 9', 'A5', 'B5'],
  ['Halbfinale 1', 'A1', 'B2'],
  ['Spiel um Platz 7', 'A4', 'B4'],
  ['Halbfinale 2', 'A2', 'B1'],
  ['Spiel um Platz 5', 'A3', 'B3'],
  ['Spiel um Platz 3', 'Verlierer HF1', 'Verlierer HF2'],
  ['Finale', 'Sieger HF1', 'Sieger HF2'],
];

export function planRows(): PlanRow[] {
  const rows: PlanRow[] = [];
  for (const [h, a] of GROUP_ORDER) {
    for (const group of ['A', 'B'] as const) {
      rows.push({ nr: rows.length + 1, round: `Gruppe ${group}`, home: { group, i: h }, away: { group, i: a } });
    }
  }
  for (const [round, home, away] of KNOCKOUT) rows.push({ nr: rows.length + 1, round, home, away });
  return rows;
}
