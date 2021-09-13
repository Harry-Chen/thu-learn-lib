import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import HtmlWebpackPlugin from 'html-webpack-plugin';
import NodePolyfillPlugin from "node-polyfill-webpack-plugin";

const __dirname = dirname(fileURLToPath(import.meta.url));

const htmlPlugin = new HtmlWebpackPlugin({
  template: './demo/index.html',
  filename: './index.html',
});

export default {
  entry: {
    index: './demo/index.ts',
  },
  output: {
    path: resolve('./dist'),
    filename: '[name].js',
  },
  plugins: [
    htmlPlugin,
    new NodePolyfillPlugin(),
  ],
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
      'parse5': resolve(__dirname, 'src/fake-parse5/'),
      'parse5-htmlparser2-tree-adapter': resolve(__dirname, 'src/fake-parse5/'),
    }
  },
  mode: 'development',
  devtool: 'inline-source-map',
};
