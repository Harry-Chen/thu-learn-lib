import { Options, defineConfig } from 'tsup';

const COMMON_OPTIONS: Options = {
  globalName: 'LearnLib',
  entry: ['src/index.ts'],
  outDir: 'lib',
  clean: true,
  terserOptions: {
    format: {
      comments: false,
      ecma: 2018,
    },
  },
};

export default defineConfig([
  {
    ...COMMON_OPTIONS,
    format: 'esm',
    dts: true,
  },
  {
    ...COMMON_OPTIONS,
    format: 'iife',
    platform: 'browser',
    minify: 'terser',
    sourcemap: true,
  },
]);
