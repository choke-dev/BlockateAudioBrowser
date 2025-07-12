import { mdsvex } from 'mdsvex';
import adapter from '@sveltejs/adapter-vercel';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

import remarkToc from 'remark-toc';
import remarkGfm from 'remark-gfm';
import rehypeSlug from 'rehype-slug';

/** @type {import('@sveltejs/kit').Config} */
const config = {
  // Consult https://svelte.dev/docs/kit/integrations
  // for more information about preprocessors
  preprocess: [
    vitePreprocess(), 
    mdsvex({
      extensions: ['.svx'],
      remarkPlugins: [
        [remarkToc, { tight: true }],
        [remarkGfm]
      ],
      rehypePlugins: [
        rehypeSlug
      ]
    })
  ],
  kit: {
    adapter: adapter({ runtime: 'nodejs22.x' }),
    version: {
      name: process.env.VERCEL_GIT_COMMIT_SHA ?? 'DEV',
      pollInterval: 60 * 60 * 1000
    },
    serviceWorker: {
      register: false // We're registering manually in app.html
    }
  },
  extensions: ['.svelte', '.svx', '.md']
};

export default config;
