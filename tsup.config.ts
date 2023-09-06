import { defineConfig } from 'tsup';

export default defineConfig({
  globalName: 'LearnLib',
  entry: ['src/index.ts'],
  outDir: 'lib',
  format: ['esm', 'iife'],
  platform: 'browser',
  clean: true,
  dts: true,
  minify: true,
  esbuildOptions: (options, context) => {
    if (context.format === 'iife') {
      options.alias = {
        parse5: 'fake-parse5',
        'parse5-htmlparser2-tree-adapter': 'fake-parse5',
      };
    }
  },
});
