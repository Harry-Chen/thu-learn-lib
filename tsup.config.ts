import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts', 'src/types.ts'],
  outDir: 'lib',
  format: ['esm'],
  clean: true,
  dts: true,
});
