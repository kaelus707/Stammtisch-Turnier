import { defineConfig } from 'vitest/config';
import { svelte } from '@sveltejs/vite-plugin-svelte';

export default defineConfig({
  base: '/Stammtisch-Turnier/',
  plugins: [svelte()],
  test: { environment: 'node' },
});
