<script lang="ts">
  import type { Snapshot } from '../../domain/types';
  import MatchCard from '../components/MatchCard.svelte';
  import RestList from '../components/RestList.svelte';

  let { snapshot, onShowFinal }: { snapshot: Snapshot; onShowFinal: () => void } = $props();
  const live = $derived(snapshot.liveIndex === null ? null : snapshot.matches[snapshot.liveIndex]);
  const next = $derived(snapshot.nextIndices.map((i) => snapshot.matches[i]));
  const last = $derived(snapshot.lastIndex === null ? null : snapshot.matches[snapshot.lastIndex]);
</script>

{#if live}
  <h2 class="section-title">Jetzt</h2>
  <MatchCard match={live} live />
{:else}
  <section class="card champion">
    <p class="muted">Turniersieger</p>
    <p class="name">{snapshot.champion ?? 'steht noch nicht fest'}</p>
    <button class="btn" onclick={onShowFinal}>Zum Endstand</button>
  </section>
{/if}

{#if next.length}
  <h2 class="section-title">Als Nächstes</h2>
  <div class="stack">
    {#each next as x (x.nr)}<MatchCard match={x} />{/each}
  </div>
{/if}

{#if live}
  <h2 class="section-title">Pausen</h2>
  <RestList entries={snapshot.rest} />
{/if}

{#if last}
  <h2 class="section-title">Letztes Ergebnis</h2>
  <MatchCard match={last} />
{/if}

<style>
  .champion {
    margin-top: 16px;
    text-align: center;
    padding: 28px 16px;
    background: linear-gradient(160deg, var(--accent), #7a0309);
    border: 0;
  }
  .champion .muted { color: rgba(255, 255, 255, 0.85); margin: 0; text-transform: uppercase; letter-spacing: 0.1em; font-size: 0.8rem; }
  .name { font-size: 1.6rem; font-weight: 900; margin: 6px 0 18px; overflow-wrap: anywhere; }
  .champion .btn { background: #fff; color: #7a0309; }
</style>
