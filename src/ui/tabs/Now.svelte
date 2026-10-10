<script lang="ts">
  import type { Snapshot } from '../../domain/types';
  let { snapshot, onShowFinal }: { snapshot: Snapshot; onShowFinal: () => void } = $props();
</script>

<p class="muted">{snapshot.settings.name}</p>
<button class="btn" onclick={onShowFinal}>Zum Endstand</button>
