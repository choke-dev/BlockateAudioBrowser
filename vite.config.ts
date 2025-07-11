import devtoolsJson from 'vite-plugin-devtools-json';
import tailwindcss from '@tailwindcss/vite';
import Icons from 'unplugin-icons/vite'
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [
    tailwindcss(),
    sveltekit(),
    devtoolsJson(),
    Icons({
      compiler: "svelte"
    })
  ],
  build: {
    rollupOptions: {
      input: {
        // Ensure service worker is included in build
        'service-worker': 'static/service-worker.js'
      }
    }
  },
  server: {
    fs: {
      // Allow serving files from static directory during development
      allow: ['..']
    }
  }
});
