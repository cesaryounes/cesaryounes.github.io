import { defineConfig } from 'vite';

// The build is a self-contained static bundle that Playables serves from a ZIP,
// so every URL must be relative and nothing may be fetched from a CDN.
export default defineConfig({
  base: './',
  build: {
    target: 'es2020',
    outDir: 'dist',
    emptyOutDir: true,
    assetsInlineLimit: 16384,
    modulePreload: { polyfill: false },
    rollupOptions: {
      output: {
        // One JS file, one CSS file: easy to audit for external requests.
        manualChunks: undefined,
        inlineDynamicImports: true,
      },
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
