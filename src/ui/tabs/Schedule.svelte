<script lang="ts">
  import type { Snapshot } from '../../domain/types';
  import MatchCard from '../components/MatchCard.svelte';

  let { snapshot }: { snapshot: Snapshot } = $props();

  const KEY = 'stammtisch-team-filter';
  function load(): string {
    try {
      return localStorage.getItem(KEY) ?? '';
    } catch {
      return '';
    }
  }
  let filter = $state(load());
  $effect(() => {
    try {
      if (filter) localStorage.setItem(KEY, filter);
      else localStorage.removeItem(KEY);
    } catch {
      // Speicher gesperrt (z. B. privater Modus): Filter gilt nur für diese Sitzung
    }
  });

  const teamNames = $derived(snapshot.tables.flatMap((t) => t.rows.map((r) => r.team)).sort((a, b) => a.localeCompare(b, 'de')));
  // Gespeicherter Filter auf ein inzwischen umbenanntes Team zeigt wieder alle Spiele
  const active = $derived(teamNames.includes(filter) ? filter : '');
  const shown = $derived(
    active ? snapshot.matches.filter((x) => x.homeSide.team === active || x.awaySide.team === active) : snapshot.matches,
  );
</script>

<label class="filter">
  <span class="muted">Team</span>
  <select bind:value={filter}>
    <option value="">Alle Teams</option>
    {#each teamNames as t (t)}<option value={t}>{t}</option>{/each}
  </select>
</label>

<div class="stack">
  {#each shown as x (x.nr)}
    <MatchCard match={x} live={x.index === snapshot.liveIndex} />
  {/each}
</div>

<style>
  .filter { display: flex; align-items: center; gap: 12px; margin: 16px 0 12px; }
  select {
    flex: 1;
    min-height: 44px;
    padding: 0 12px;
    border-radius: 10px;
    border: 1px solid var(--border);
    background: var(--surface);
  }
</style>
