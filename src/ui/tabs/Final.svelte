<script lang="ts">
  import type { Snapshot } from '../../domain/types';
  import MatchCard from '../components/MatchCard.svelte';

  let { snapshot }: { snapshot: Snapshot } = $props();
  const ko = $derived(snapshot.matches.filter((x) => x.group === null));
  const find = (round: string) => ko.find((x) => x.round === round);
  const semis = $derived(['Halbfinale 1', 'Halbfinale 2'].map(find).filter((x) => x !== undefined));
  const finals = $derived(['Spiel um Platz 3', 'Finale'].map(find).filter((x) => x !== undefined));
  const placements = $derived(ko.filter((x) => !/^Halbfinale [12]$|^Finale$|^Spiel um Platz 3$/.test(x.round)));
</script>

{#if snapshot.liveIndex === null && snapshot.matches.length > 0}
  <h2 class="section-title">Endstand</h2>
  <ol class="card ranking">
    {#each snapshot.ranking as team, i}
      <li class:podium={i < 3}>
        <span class="place num">{i + 1}.</span>
        <span>{team ?? '–'}</span>
      </li>
    {/each}
  </ol>
{/if}

{#if placements.length}
  <h2 class="section-title">Platzierungsspiele</h2>
  <div class="stack">
    {#each placements as x (x.nr)}<MatchCard match={x} live={x.index === snapshot.liveIndex} />{/each}
  </div>
{/if}

{#if semis.length}
  <h2 class="section-title">Halbfinale</h2>
  <div class="stack">
    {#each semis as x (x.nr)}<MatchCard match={x} live={x.index === snapshot.liveIndex} />{/each}
  </div>
{/if}

{#if finals.length}
  <h2 class="section-title">Platz 3 und Finale</h2>
  <div class="stack">
    {#each finals as x (x.nr)}<MatchCard match={x} live={x.index === snapshot.liveIndex} />{/each}
  </div>
{/if}

<style>
  .ranking { list-style: none; margin: 0; padding: 4px 16px; }
  .ranking li { display: flex; gap: 12px; padding: 10px 0; border-bottom: 1px solid var(--border); font-weight: 600; }
  .ranking li:last-child { border-bottom: 0; }
  .place { width: 2.2em; color: var(--text-muted); }
  .podium { font-size: 1.05rem; }
  .podium .place { color: var(--accent-text); font-weight: 800; }
</style>
