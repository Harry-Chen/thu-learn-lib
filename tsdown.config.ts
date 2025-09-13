import { type Options, defineConfig } from 'tsdown';

const COMMON_OPTIONS: Options = {
  globalName: 'LearnLib',
  entry: ['src/index.ts'],
  outDir: 'lib',
  clean: true,
};

export default defineConfig([
  {
    ...COMMON_OPTIONS,
    exports: {
      devExports: true,
    },
    platform: 'node',
    dts: true,
  },
  {
    ...COMMON_OPTIONS,
    format: 'iife',
    platform: 'browser',
    noExternal: () => true,
    minify: true,
    sourcemap: true,
  },
]);
