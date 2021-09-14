import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import HtmlWebpackPlugin from 'html-webpack-plugin';
import CopyPlugin from 'copy-webpack-plugin';
import NodePolyfillPlugin from 'node-polyfill-webpack-plugin';
import RemovePlugin from 'remove-files-webpack-plugin';

const __dirname = dirname(fileURLToPath(import.meta.url));

const htmlPlugin = new HtmlWebpackPlugin({
  template: './demo/index.html',
  filename: './index.html',
});

const copyPolyFill = new CopyPlugin({
  patterns: [{ from: './node_modules/webextension-polyfill/dist/browser-polyfill.min.js', to: './' }],
});

const removeRedundantFile = new RemovePlugin({
  // remove output dist files
  before: {
    include: ['./dist/index.html', './dist/browser-polyfill.min.js', './dist/index.js'],
  },
  // remove .d.ts files produced by Webpack to source directories
  after: {
    include: ['./lib/src', './lib/demo'],
  },
});

export default {
  entry: {
    index: './demo/index.ts',
  },
  output: {
    path: resolve('./dist'),
    filename: '[name].js',
  },
  plugins: [new NodePolyfillPlugin(), htmlPlugin, copyPolyFill, removeRedundantFile],
  devServer: {
    contentBase: './dist',
    headers: {
      'Access-Control-Allow-Origin': '*',
    },
  },
  module: {
    rules: [
      {
        exclude: /node_modules/,
        test: /\.tsx?$/,
        use: 'ts-loader',
      },
    ],
  },
  resolve: {
    extensions: ['.ts', '.tsx', '.js'],
    alias: {
      parse5: resolve(__dirname, 'src/fake-parse5/'),
      'parse5-htmlparser2-tree-adapter': resolve(__dirname, 'src/fake-parse5/'),
    },
  },
  mode: 'development',
  devtool: 'inline-source-map',
};
