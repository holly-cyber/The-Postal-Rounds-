// @ts-check
import { defineConfig } from 'astro/config';

// Static output. The API lives in netlify/functions and is served under /api/*.
export default defineConfig({
  output: 'static',
  // Live address, used for absolute share-preview links (og:image, canonical).
  site: 'https://thepostmanschallenge.com',
});
