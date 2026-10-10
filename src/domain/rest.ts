import type { RestEntry, ScheduledMatch, Team } from './types';

export function restOverview(
  teams: Team[],
  matches: ScheduledMatch[],
  live: number | null,
  ranking: (string | null)[],
): RestEntry[] {
  const unresolvedOpen = matches.some((x) => !x.finished && (!x.homeSide.team || !x.awaySide.team));
  const entries = teams.map(({ name }): RestEntry => {
    const k = live === null ? -1 : matches.findIndex((x) => !x.finished && (x.homeSide.team === name || x.awaySide.team === name));
    if (live !== null && k !== -1) {
      const status = k === live ? 'playing' : k === live + 1 ? 'next' : 'resting';
      return { team: name, status, gap: Math.max(0, k - live - 1), matchIndex: k, nextNr: matches[k].nr, place: null };
    }
    const placeIdx = ranking.indexOf(name);
    const place = placeIdx === -1 ? null : placeIdx + 1;
    const status = place === null && unresolvedOpen ? 'waiting' : 'done';
    return { team: name, status, gap: 0, matchIndex: null, nextNr: null, place: status === 'done' ? place : null };
  });
  const key = (e: RestEntry) => e.matchIndex ?? (e.status === 'waiting' ? 1e6 : 2e6);
  return entries.sort((a, b) => key(a) - key(b) || a.team.localeCompare(b.team, 'de'));
}

const withNr = (text: string, e: RestEntry) => (e.nextNr === null ? text : `${text} · Spiel ${e.nextNr}`);

export function restLabel(e: RestEntry): string {
  switch (e.status) {
    case 'playing':
      return withNr('spielt jetzt', e);
    case 'next':
      return withNr('nächstes Spiel', e);
    case 'resting': {
      return withNr(`noch ${e.gap} ${e.gap === 1 ? 'Spiel' : 'Spiele'} Pause`, e);
    }
    case 'waiting':
      return 'wartet auf Finalrunde';
    case 'done':
      return e.place ? `fertig · Platz ${e.place}` : 'fertig';
  }
}
