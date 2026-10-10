import { finalRanking, resolveMatches } from './bracket';
import { restOverview } from './rest';
import { findLast, findLive, findNext, plannedStart, sortByNr } from './schedule';
import { scorerList } from './scorers';
import { computeStandings } from './standings';
import type { ScheduledMatch, Snapshot, TournamentData } from './types';
import { isFinished } from './types';

export function buildSnapshot(data: TournamentData, parseWarnings: string[] = []): Snapshot {
  const warnings = [...parseWarnings];
  const tables = (['A', 'B'] as const).map((g) => computeStandings(data.teams, data.matches, g));
  const resolved = resolveMatches(sortByNr(data.matches), tables);
  const matches: ScheduledMatch[] = resolved.map((x, index) => ({
    ...x, index, startMinutes: plannedStart(index, data.settings), finished: isFinished(x),
  }));
  for (const x of matches) if (x.undecided) warnings.push(`Spiel ${x.nr}: Unentschieden im K.-o.-Spiel – Sieger unbestimmt.`);
  const liveIndex = findLive(matches);
  const ranking = finalRanking(resolved, data.teams.length);
  return {
    settings: data.settings,
    tables,
    matches,
    liveIndex,
    nextIndices: findNext(matches, liveIndex),
    lastIndex: findLast(matches),
    rest: restOverview(data.teams, matches, liveIndex, ranking),
    scorers: scorerList(data.players),
    ranking,
    champion: liveIndex === null ? (ranking[0] ?? null) : null,
    warnings,
  };
}
