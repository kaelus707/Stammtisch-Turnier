<script lang="ts">
  import type { Snapshot } from '../../domain/types';
  import StandingsTable from '../components/StandingsTable.svelte';

  let { snapshot }: { snapshot: Snapshot } = $props();
</script>

<div class="tables">
  {#each snapshot.tables as t (t.group)}<StandingsTable table={t} />{/each}
</div>

<style>
  .tables { display: grid; gap: 12px; margin-top: 16px; }
</style>
