<script lang="ts">
  import type { Snapshot } from '../../domain/types';
  let { snapshot }: { snapshot: Snapshot } = $props();
</script>

<p class="muted">{snapshot.settings.name}</p>
