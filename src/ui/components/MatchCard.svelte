<script lang="ts">
  import { formatTime } from '../../domain/schedule';
  import type { ScheduledMatch } from '../../domain/types';
  import LiveBadge from './LiveBadge.svelte';

  let { match, live = false }: { match: ScheduledMatch; live?: boolean } = $props();
  const time = $derived(match.startMinutes === null ? null : `${formatTime(match.startMinutes)} Uhr`);
</script>

<article class="card match" class:live class:done={match.finished && !live}>
  <div class="meta">
    {#if live}<LiveBadge />{/if}
    <span class="round">Spiel {match.nr} · {match.round}</span>
    {#if time}<span class="time num">{live ? `Spielstart geplant: ${time}` : time}</span>{/if}
  </div>
  <div class="teams">
    <span class="team home" class:pending={!match.homeSide.team} class:winner={match.winner !== null && match.winner === match.homeSide.team}>{match.homeSide.label}</span>
    <span class="score num">{match.finished ? `${match.homeGoals} : ${match.awayGoals}` : '–'}</span>
    <span class="team away" class:pending={!match.awaySide.team} class:winner={match.winner !== null && match.winner === match.awaySide.team}>{match.awaySide.label}</span>
  </div>
  {#if match.undecided}<p class="hint">Unentschieden – Sieger unbestimmt</p>{/if}
</article>

<style>
  .match.live { border-color: var(--accent); box-shadow: 0 0 0 1px var(--accent) inset; }
  .match.done .team, .match.done .score { color: var(--text-muted); }
  .match.done .winner { color: var(--text); }
  .meta { display: flex; flex-wrap: wrap; align-items: center; gap: 4px 10px; font-size: 0.78rem; color: var(--text-muted); }
  .time { margin-left: auto; }
  .teams { display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; gap: 10px; margin-top: 10px; }
  .team { font-weight: 700; overflow-wrap: break-word; hyphens: auto; min-width: 0; }
  .home { text-align: right; }
  .live .team { font-size: 1.15rem; }
  .pending { color: var(--text-muted); font-weight: 500; font-style: italic; }
  .winner { color: var(--text); text-decoration: underline; text-decoration-color: var(--accent); text-underline-offset: 4px; }
  .score { min-width: 3.2em; text-align: center; font-size: 1.2rem; font-weight: 800; }
  .live .score { font-size: 1.5rem; }
  .hint { margin: 8px 0 0; font-size: 0.8rem; color: var(--accent-text); }
</style>
