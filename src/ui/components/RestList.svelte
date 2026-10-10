<script lang="ts">
  import { restLabel } from '../../domain/rest';
  import type { RestEntry } from '../../domain/types';

  let { entries }: { entries: RestEntry[] } = $props();
</script>

<ul class="card rest">
  {#each entries as e (e.team)}
    <li class={e.status}>
      <span class="team">{e.team}</span>
      <span class="status num">{restLabel(e)}</span>
    </li>
  {/each}
</ul>

<style>
  .rest { list-style: none; margin: 0; padding: 4px 16px; }
  li { display: flex; justify-content: space-between; gap: 12px; padding: 10px 0; border-bottom: 1px solid var(--border); }
  li:last-child { border-bottom: 0; }
  .team { font-weight: 600; overflow-wrap: anywhere; }
  .status { text-align: right; font-size: 0.88rem; color: var(--text-muted); flex: none; max-width: 60%; }
  .playing .status { color: var(--accent-text); font-weight: 700; }
  .next .status { color: var(--text); font-weight: 700; }
  .done { opacity: 0.6; }
</style>
