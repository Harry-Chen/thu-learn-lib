import { defineConfig } from 'vite';
import webExtension from 'vite-plugin-web-extension';

export default defineConfig({
  plugins: [
    webExtension({
      additionalInputs: ['demo/index.html'],
      manifest: 'demo/manifest.json',
    }),
  ],
});
