import type { Group, GroupTable, Match, StandingRow, Team } from './types';
import { isFinished } from './types';

type Stats = Omit<StandingRow, 'rank' | 'lotPending'>;

function record(s: Stats, scored: number, conceded: number) {
  s.played++;
  s.goalsFor += scored;
  s.goalsAgainst += conceded;
  s.diff = s.goalsFor - s.goalsAgainst;
  if (scored > conceded) {
    s.won++;
    s.points += 3;
  } else if (scored === conceded) {
    s.drawn++;
    s.points += 1;
  } else s.lost++;
}

function tally(names: string[], matches: Match[]): Map<string, Stats> {
  const map = new Map<string, Stats>(
    names.map((team) => [team, { team, played: 0, won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0, diff: 0, points: 0 }]),
  );
  for (const x of matches) {
    if (!isFinished(x)) continue;
    const home = map.get(x.home);
    const away = map.get(x.away);
    if (!home || !away) continue;
    record(home, x.homeGoals!, x.awayGoals!);
    record(away, x.awayGoals!, x.homeGoals!);
  }
  return map;
}

export function computeStandings(teams: Team[], matches: Match[], group: Group): GroupTable {
  const groupTeams = teams.filter((t) => t.group === group);
  const groupMatches = matches.filter((x) => x.group === group);
  const lots = new Map(groupTeams.map((t) => [t.name, t.lot]));
  const lotOf = (s: Stats) => lots.get(s.team) ?? null;
  const all = [...tally(groupTeams.map((t) => t.name), groupMatches).values()].sort(
    (a, b) => b.points - a.points || b.diff - a.diff,
  );

  const rows: StandingRow[] = [];
  for (let i = 0; i < all.length; ) {
    let j = i + 1;
    while (j < all.length && all[j].points === all[i].points && all[j].diff === all[i].diff) j++;
    const bucket = all.slice(i, j);
    const names = bucket.map((s) => s.team);
    const h2h = tally(names, groupMatches.filter((x) => names.includes(x.home) && names.includes(x.away)));
    const byTiebreak = (a: Stats, b: Stats) => {
      const ha = h2h.get(a.team)!;
      const hb = h2h.get(b.team)!;
      return hb.points - ha.points || hb.diff - ha.diff || b.goalsFor - a.goalsFor;
    };
    const byLot = (a: Stats, b: Stats) => {
      const la = lotOf(a);
      const lb = lotOf(b);
      if (la === lb) return 0;
      if (la === null) return 1;
      if (lb === null) return -1;
      return la - lb;
    };
    const tied = (a: Stats, b: Stats) =>
      byTiebreak(a, b) === 0 && (lotOf(a) === null || lotOf(b) === null || lotOf(a) === lotOf(b));
    bucket.sort((a, b) => byTiebreak(a, b) || byLot(a, b));
    bucket.forEach((s, k) =>
      rows.push({
        ...s,
        rank: rows.length + 1,
        lotPending: (k > 0 && tied(s, bucket[k - 1])) || (k < bucket.length - 1 && tied(s, bucket[k + 1])),
      }),
    );
    i = j;
  }
  return { group, rows, complete: groupMatches.length > 0 && groupMatches.every(isFinished) };
}
