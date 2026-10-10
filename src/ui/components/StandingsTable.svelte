<script lang="ts">
  import type { GroupTable } from '../../domain/types';

  let { table }: { table: GroupTable } = $props();
</script>

<section class="card standings">
  <h3>Gruppe {table.group}</h3>
  <div class="scroll">
    <table>
      <thead>
        <tr>
          <th scope="col">Pl.</th>
          <th scope="col" class="team">Team</th>
          <th scope="col">Sp.</th>
          <th scope="col">S</th>
          <th scope="col">U</th>
          <th scope="col">N</th>
          <th scope="col">Tore</th>
          <th scope="col">Diff.</th>
          <th scope="col">Pkt.</th>
        </tr>
      </thead>
      <tbody>
        {#each table.rows as r (r.team)}
          <tr class:semi={r.rank <= 2}>
            <td class="num">{r.rank}</td>
            <td class="team">
              {r.team}{#if table.complete && r.lotPending}<span class="tag">Los ausstehend</span>{/if}
            </td>
            <td class="num">{r.played}</td>
            <td class="num">{r.won}</td>
            <td class="num">{r.drawn}</td>
            <td class="num">{r.lost}</td>
            <td class="num">{r.goalsFor}:{r.goalsAgainst}</td>
            <td class="num">{r.diff > 0 ? '+' : ''}{r.diff}</td>
            <td class="num pts">{r.points}</td>
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
  <p class="legend muted"><span class="swatch" aria-hidden="true"></span>Halbfinale</p>
</section>

<style>
  .standings { padding: 14px 0 10px; }
  h3 { margin: 0 16px 8px; font-size: 1rem; }
  .scroll { overflow-x: auto; }
  table { width: 100%; border-collapse: collapse; font-size: 0.85rem; }
  th { color: var(--text-muted); font-weight: 600; font-size: 0.72rem; padding: 6px 4px; text-align: center; }
  td { padding: 10px 4px; text-align: center; border-top: 1px solid var(--border); }
  th:first-child, td:first-child { padding-left: 16px; }
  th:last-child, td:last-child { padding-right: 16px; }
  .team { text-align: left; font-weight: 600; min-width: 7.5em; }
  .pts { font-weight: 800; }
  tr.semi td:first-child { box-shadow: inset 4px 0 0 var(--accent); }
  .tag { display: block; font-size: 0.7rem; font-weight: 500; color: var(--accent-text); }
  .legend { display: flex; align-items: center; gap: 8px; margin: 8px 16px 0; font-size: 0.75rem; }
  .swatch { width: 4px; height: 14px; background: var(--accent); border-radius: 2px; }
</style>
