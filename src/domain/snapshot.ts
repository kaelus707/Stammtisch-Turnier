import { restOverview } from './rest';
import { findLast, findLive, findNext, plannedStart, sortByNr } from './schedule';
import { scorerList } from './scorers';
import type { ScheduledMatch, Snapshot, TournamentData } from './types';
import { isFinished } from './types';

/** Ordnet die fertig gerechneten Daten der Tabelle für die Anzeige an – gewertet wird nur in der Tabelle. */
export function buildSnapshot(data: TournamentData, parseWarnings: string[] = []): Snapshot {
  const warnings = [...parseWarnings];
  const matches: ScheduledMatch[] = sortByNr(data.matches).map((x, index) => ({
    ...x, index, startMinutes: plannedStart(index, data.settings), finished: isFinished(x),
  }));
  for (const x of matches) if (x.undecided) warnings.push(`Spiel ${x.nr}: Unentschieden im K.-o.-Spiel – Sieger unbestimmt.`);
  const liveIndex = findLive(matches);
  const { ranking } = data;
  return {
    settings: data.settings,
    tables: data.tables,
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
