import type { Player, ScorerRow } from './types';

export function scorerList(players: Player[]): ScorerRow[] {
  const sorted = players
    .filter((p) => p.goals > 0)
    .sort((a, b) => b.goals - a.goals || a.name.localeCompare(b.name, 'de'));
  return sorted.map((p) => ({ ...p, rank: sorted.findIndex((q) => q.goals === p.goals) + 1 }));
}
