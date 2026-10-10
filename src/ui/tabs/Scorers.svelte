<script lang="ts">
  import type { Snapshot } from '../../domain/types';

  let { snapshot }: { snapshot: Snapshot } = $props();
</script>

{#if snapshot.scorers.length === 0}
  <p class="muted empty">Noch keine Tore eingetragen.</p>
{:else}
  <ol class="card scorers">
    <!-- ohne Key: gleichnamige Spieler im selben Team dürfen nicht abstürzen -->
    {#each snapshot.scorers as s}
      <li class:top={s.rank <= 3}>
        <span class="rank num">{s.rank}.</span>
        <span class="who">
          <span class="name">{s.name}</span>
          <span class="muted team">{s.team}</span>
        </span>
        <span class="goals num">{s.goals}</span>
      </li>
    {/each}
  </ol>
{/if}

<style>
  .empty { text-align: center; margin-top: 48px; }
  .scorers { list-style: none; margin: 16px 0 0; padding: 4px 16px; }
  li { display: flex; align-items: center; gap: 12px; padding: 10px 0; border-bottom: 1px solid var(--border); }
  li:last-child { border-bottom: 0; }
  .rank { width: 2em; color: var(--text-muted); }
  .who { flex: 1; min-width: 0; display: flex; flex-direction: column; }
  .name { font-weight: 600; overflow-wrap: anywhere; }
  .team { font-size: 0.8rem; }
  .goals { font-size: 1.1rem; font-weight: 800; }
  .top .rank { color: var(--accent-text); font-weight: 800; }
  .top .goals {
    min-width: 2em;
    text-align: center;
    padding: 2px 8px;
    border-radius: 999px;
    background: var(--accent);
    color: #fff;
  }
</style>
