<script lang="ts">
  import { onMount } from 'svelte';
  import { REFRESH_MS, SHEET_ID } from '../data/config';
  import { parseTournament } from '../data/parse';
  import { fetchSheets } from '../data/sheets';
  import { buildSnapshot } from '../domain/snapshot';
  import type { Snapshot } from '../domain/types';
  import WarningBox from './components/WarningBox.svelte';
  import { clock } from './format';
  import Final from './tabs/Final.svelte';
  import Now from './tabs/Now.svelte';
  import Schedule from './tabs/Schedule.svelte';
  import Scorers from './tabs/Scorers.svelte';
  import Tables from './tabs/Tables.svelte';

  type TabId = 'now' | 'schedule' | 'tables' | 'final' | 'scorers';
  const TABS: { id: TabId; label: string; icon: string }[] = [
    { id: 'now', label: 'Jetzt', icon: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="3" fill="currentColor"/>' },
    { id: 'schedule', label: 'Spielplan', icon: '<path d="M9 6h11M9 12h11M9 18h11M4 6h.01M4 12h.01M4 18h.01"/>' },
    { id: 'tables', label: 'Tabellen', icon: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 10h18M3 15h18M9 4v16"/>' },
    { id: 'final', label: 'Finale', icon: '<path d="M3 5h5v6h5M3 19h5v-6M13 11v2M13 12h8"/>' },
    { id: 'scorers', label: 'Torschützen', icon: '<circle cx="12" cy="12" r="9"/><path d="M12 7.5l3.8 2.8-1.5 4.4H9.7l-1.5-4.4z"/>' },
  ];

  // Tab steht im Hash der Adresse, damit Neuladen auf derselben Seite landet
  const fromHash = location.hash.slice(1) as TabId;
  let tab = $state<TabId>(TABS.some((t) => t.id === fromHash) ? fromHash : 'now');
  let snapshot = $state<Snapshot | null>(null);
  let loadedAt = $state<number | null>(null);
  let failed = $state(false);
  let loading = $state(false);

  async function refresh() {
    if (loading) return;
    loading = true;
    try {
      const raw = await fetchSheets(SHEET_ID, import.meta.env.BASE_URL);
      const { data, warnings } = parseTournament(raw);
      snapshot = buildSnapshot(data, warnings);
      loadedAt = Date.now();
      failed = false;
    } catch (e) {
      console.error(e);
      failed = true;
    } finally {
      loading = false;
    }
  }

  function show(id: TabId) {
    tab = id;
    history.replaceState(null, '', `#${id}`);
    window.scrollTo(0, 0);
  }

  onMount(() => {
    refresh();
    const poll = setInterval(refresh, REFRESH_MS);
    const onVisible = () => {
      if (document.visibilityState === 'visible') refresh();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(poll);
      document.removeEventListener('visibilitychange', onVisible);
    };
  });

  $effect(() => {
    if (snapshot) document.title = snapshot.settings.name;
  });
</script>

<header class="top">
  <img src={`${import.meta.env.BASE_URL}logo.png`} alt="Wappen SV Saaldorf" width="44" height="44" />
  <div class="title">
    <h1>{snapshot?.settings.name ?? 'Stammtischturnier'}</h1>
    <p class="muted">
      {snapshot?.settings.date ?? ''}{#if loadedAt !== null}{snapshot?.settings.date ? ' · ' : ''}<span class="dot" class:off={failed}></span>Stand {clock(loadedAt)}{/if}
    </p>
  </div>
  <button class="reload" class:spin={loading} onclick={refresh} disabled={loading} aria-label="Aktualisieren">
    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 12a8 8 0 1 1-2.34-5.66M20 4v5h-5"/></svg>
  </button>
</header>

{#if failed && snapshot && loadedAt !== null}
  <div class="banner" role="status">Offline – Daten von {clock(loadedAt)} Uhr</div>
{/if}

<main>
  {#if snapshot}
    {#if snapshot.warnings.length}<WarningBox warnings={snapshot.warnings} />{/if}
    {#if tab === 'now'}
      <Now {snapshot} onShowFinal={() => show('final')} />
    {:else if tab === 'schedule'}
      <Schedule {snapshot} />
    {:else if tab === 'tables'}
      <Tables {snapshot} />
    {:else if tab === 'final'}
      <Final {snapshot} />
    {:else}
      <Scorers {snapshot} />
    {/if}
  {:else if failed}
    <div class="card error" role="alert">
      <p>Die Turnierdaten konnten nicht geladen werden.</p>
      <button class="btn" onclick={refresh}>Erneut versuchen</button>
    </div>
  {:else}
    <p class="muted loading">Lade Turnierdaten …</p>
  {/if}
</main>

<nav class="tabs" aria-label="Bereiche">
  {#each TABS as t (t.id)}
    <button class:active={tab === t.id} aria-current={tab === t.id ? 'page' : undefined} onclick={() => show(t.id)}>
      <svg viewBox="0 0 24 24" aria-hidden="true">{@html t.icon}</svg>
      <span>{t.label}</span>
    </button>
  {/each}
</nav>

<style>
  .top {
    position: sticky;
    top: 0;
    z-index: 10;
    display: flex;
    align-items: center;
    gap: 12px;
    padding: calc(10px + env(safe-area-inset-top)) 16px 10px;
    background: rgba(11, 11, 13, 0.92);
    backdrop-filter: blur(8px);
    border-bottom: 1px solid var(--border);
  }
  .top img { flex: none; object-fit: contain; }
  .title { min-width: 0; flex: 1; }
  .dot { display: inline-block; width: 7px; height: 7px; margin-right: 6px; border-radius: 50%; background: #3ecf6e; vertical-align: 1px; }
  .dot.off { background: var(--text-muted); }
  .reload {
    flex: none;
    display: grid;
    place-items: center;
    width: 44px;
    height: 44px;
    border: 1px solid var(--border);
    border-radius: 12px;
    background: var(--surface-2);
    color: var(--text);
    cursor: pointer;
  }
  .reload svg { width: 22px; height: 22px; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
  .reload.spin svg { animation: spin 0.8s linear infinite; }
  @keyframes spin { to { transform: rotate(360deg); } }
  h1 { margin: 0; font-size: 1.05rem; font-weight: 800; overflow-wrap: break-word; hyphens: auto; }
  .title p { margin: 2px 0 0; font-size: 0.8rem; }
  .banner {
    margin: 12px 16px 0;
    padding: 10px 14px;
    border-radius: var(--radius);
    background: var(--surface-2);
    border-left: 4px solid var(--accent);
    font-size: 0.9rem;
  }
  main {
    max-width: 640px;
    margin: 0 auto;
    padding: 4px 16px calc(var(--nav-h) + 24px + env(safe-area-inset-bottom));
  }
  .loading { text-align: center; margin-top: 48px; }
  .error { margin-top: 24px; text-align: center; }
  .tabs {
    position: fixed;
    inset: auto 0 0 0;
    z-index: 10;
    display: grid;
    grid-template-columns: repeat(5, 1fr);
    height: calc(var(--nav-h) + env(safe-area-inset-bottom));
    padding-bottom: env(safe-area-inset-bottom);
    background: var(--surface);
    border-top: 1px solid var(--border);
  }
  .tabs button {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 3px;
    min-width: 0;
    border: 0;
    padding: 0 2px;
    background: none;
    color: var(--text-muted);
    font-size: 0.75rem;
    cursor: pointer;
  }
  .tabs button.active { color: var(--text); }
  .tabs button.active svg { color: var(--accent-text); }
  .tabs svg { width: 24px; height: 24px; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
  .tabs span { max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
</style>
