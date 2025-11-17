import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import icon from 'astro-icon';

import mdi from '@iconify-json/mdi/icons.json';
import ri from '@iconify-json/ri/icons.json';
import fa6solid from '@iconify-json/fa6-solid/icons.json';
import logos from '@iconify-json/logos/icons.json';

export default defineConfig({
  integrations: [
    icon({
      collections: {
        logos,
        mdi,
        ri,
        'fa6-solid': fa6solid,
      },
    }),
  ],
  vite: {
    plugins: [tailwindcss()],
  },
});