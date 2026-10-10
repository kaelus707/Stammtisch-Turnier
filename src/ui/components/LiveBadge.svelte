<script lang="ts"></script>

<span class="live"><span class="dot" aria-hidden="true"></span>LIVE</span>

<style>
  .live {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 3px 9px;
    border-radius: 999px;
    background: var(--accent);
    color: #fff;
    font-size: 0.72rem;
    font-weight: 800;
    letter-spacing: 0.08em;
  }
  .dot { width: 8px; height: 8px; border-radius: 50%; background: #fff; animation: pulse 1.4s ease-in-out infinite; }
  @keyframes pulse {
    0%, 100% { opacity: 1; transform: scale(1); }
    50% { opacity: 0.35; transform: scale(0.7); }
  }
</style>
