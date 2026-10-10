import type { GroupTable, Match, ResolvedMatch, Side } from './types';
import { isFinished } from './types';

function groupSlot(raw: string, tables: GroupTable[]): Side | null {
  const slot = /^([AB])([1-5])$/.exec(raw);
  if (!slot) return null;
  const table = tables.find((t) => t.group === slot[1]);
  const row = table?.rows[Number(slot[2]) - 1];
  if (!table?.complete || !row) return { team: null, label: raw };
  if (row.lotPending) return { team: null, label: `${raw} (Los ausstehend)` };
  return { team: row.team, label: row.team };
}

function decide(x: Match, homeSide: Side, awaySide: Side): ResolvedMatch {
  let winner: string | null = null;
  let loser: string | null = null;
  let undecided = false;
  if (isFinished(x) && homeSide.team && awaySide.team) {
    if (x.homeGoals! > x.awayGoals!) [winner, loser] = [homeSide.team, awaySide.team];
    else if (x.homeGoals! < x.awayGoals!) [winner, loser] = [awaySide.team, homeSide.team];
    else undecided = x.group === null;
  }
  return { ...x, homeSide, awaySide, winner, loser, undecided };
}

export function resolveMatches(matches: Match[], tables: GroupTable[]): ResolvedMatch[] {
  const semis = new Map<string, ResolvedMatch>();
  const side = (raw: string): Side => {
    const g = groupSlot(raw, tables);
    if (g) return g;
    const k = /^(Sieger|Verlierer) HF([12])$/.exec(raw);
    if (k) {
      const semi = semis.get(k[2]);
      const team = semi ? (k[1] === 'Sieger' ? semi.winner : semi.loser) : null;
      return { team, label: team ?? raw };
    }
    return { team: raw, label: raw };
  };
  // Halbfinals zuerst, weil Platz 3 und Finale von ihnen abhängen
  for (const x of matches) {
    const hf = /^Halbfinale ([12])$/.exec(x.round);
    if (hf) semis.set(hf[1], decide(x, side(x.home), side(x.away)));
  }
  return matches.map((x) => decide(x, side(x.home), side(x.away)));
}

export function finalRanking(resolved: ResolvedMatch[], teamCount: number): (string | null)[] {
  const out: (string | null)[] = Array(teamCount).fill(null);
  for (const x of resolved) {
    if (x.group !== null || !x.winner) continue;
    const place = x.round === 'Finale' ? 1 : Number(/^Spiel um Platz (\d+)$/.exec(x.round)?.[1]);
    if (place >= 1 && place < teamCount) {
      out[place - 1] = x.winner;
      out[place] = x.loser;
    }
  }
  return out;
}
