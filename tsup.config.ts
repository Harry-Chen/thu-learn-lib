import { Options, defineConfig } from 'tsup';

const COMMON_OPTIONS: Options = {
  globalName: 'LearnLib',
  entry: ['src/index.ts'],
  outDir: 'lib',
  clean: true,
  esbuildOptions: (options, context) => {
    if (context.format === 'iife') {
      options.alias = {
        parse5: 'fake-parse5',
        'parse5-htmlparser2-tree-adapter': 'fake-parse5',
      };
    }
  },
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
