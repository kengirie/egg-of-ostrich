import path from "node:path";

import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vitest/config";

import { siteAssetsManifest } from "./vite-plugin-site-assets";

// https://vitejs.dev/config/
export default defineConfig(() => ({
  // Nest sites are always served from "/", so the app is a root-base build.
  base: "/",
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [
    react(),
    tailwindcss(),
    siteAssetsManifest(),
  ],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    // Node 25+ ships a global localStorage that shadows jsdom's (and throws
    // without --localstorage-file). Turn it off so tests see jsdom storage.
    execArgv: ['--no-experimental-webstorage'],
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/{vite,eslint}.config.*',
      '.agents/**',
    ],
    onConsoleLog(log) {
      return !log.includes("React Router Future Flag Warning");
    },
    env: {
      DEBUG_PRINT_LIMIT: '0', // Suppress DOM output that exceeds AI context windows
      VITE_APP_NSITE_PUBKEY: 'f'.repeat(64),
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
    },
  },
}));