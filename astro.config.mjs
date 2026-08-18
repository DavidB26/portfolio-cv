import { defineConfig, envField } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import icon from 'astro-icon';
import node from '@astrojs/node';

import mdi from '@iconify-json/mdi/icons.json';
import ri from '@iconify-json/ri/icons.json';
import fa6solid from '@iconify-json/fa6-solid/icons.json';
import logos from '@iconify-json/logos/icons.json';

export default defineConfig({
  site: 'https://davidbeslanga.com',
  output: 'server',
  adapter: node({ mode: 'standalone' }),
  security: {
    checkOrigin: true,
    allowedDomains: [
      { protocol: 'https', hostname: 'davidbeslanga.com' },
      { protocol: 'https', hostname: 'www.davidbeslanga.com' },
      { protocol: 'http', hostname: 'localhost' },
      { protocol: 'http', hostname: '127.0.0.1' },
    ],
  },
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
  env: {
    schema: {
      FROM_EMAIL: envField.string({
        context: 'server',
        access: 'secret',
        optional: false,
        default: 'INFORM_VALID_EMAIL'
      }),
      TO_EMAIL: envField.string({
        context: 'server',
        access: 'secret',
        optional: false,
        default: 'INFORM_VALID_EMAIL'
      }),
      RESEND_API_KEY: envField.string({
        context: 'server',
        access: 'secret',
        optional: false,
        default: 'INFORM_VALID_TOKEN'
      }),
      PUBLIC_TURNSTILE_SITE_KEY: envField.string({
        context: 'client',
        access: 'public',
        optional: true
      }),
      TURNSTILE_SECRET_KEY: envField.string({
        context: 'server',
        access: 'secret',
        optional: true
      })
    }
  },
  vite: {
    plugins: [tailwindcss()],
  },
});
