<script lang="ts">
  let { warnings }: { warnings: string[] } = $props();
</script>

<details class="warnings">
  <summary>{warnings.length} {warnings.length === 1 ? 'Hinweis' : 'Hinweise'} zu den Daten</summary>
  <ul>
    {#each warnings as w}
      <li>{w}</li>
    {/each}
  </ul>
</details>

<style>
  .warnings {
    margin-top: 12px;
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: 0 14px;
    font-size: 0.85rem;
    color: var(--text-muted);
  }
  summary { min-height: 44px; display: flex; align-items: center; cursor: pointer; }
  ul { margin: 0 0 12px; padding-left: 18px; }
</style>
