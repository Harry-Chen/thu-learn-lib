const path = require("path");
const HtmlWebpackPlugin = require('html-webpack-plugin');


const htmlPlugin = new HtmlWebpackPlugin({
  template: "./test/index.html",
  filename: "./index.html"
});

module.exports = {
  entry: {
    index: "./test/index.ts",
  },
  output: {
    path: path.resolve("./dist"),
    filename: "[name].js"
  },
  plugins: [htmlPlugin],
  devServer: {
    contentBase: './dist'
  },
  module: {
    rules: [
      {
        exclude: /node_modules/,
        test: /\.tsx?$/,
        use: "ts-loader"
      }
    ]
  },
  resolve: {
    extensions: [".ts", ".tsx", ".js"]
  },
  mode: "development",
  devtool: "inline-source-map",
  devServer: {
    headers: {
        'Access-Control-Allow-Origin': '*'
    }
  }
};
