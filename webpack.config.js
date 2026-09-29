'use strict';

const HtmlWebpackPlugin = require('html-webpack-plugin');
const Webpack = require('webpack');

const PRODUCTION = process.env.NODE_ENV === 'production';

// env.fresh comes from `webpack serve --env fresh` (yarn start:fresh)
module.exports = (env) => ({
  entry: './app/index.tsx',
  output: {
    path: `${__dirname}/build`,
    filename: PRODUCTION ? '[name].[contenthash].js' : '[name].[fullhash].js',
    publicPath: '/',
  },
  resolve: {
    extensions: ['.tsx', '.ts', '.jsx', '.js'],
  },
  devtool: PRODUCTION ? 'source-map' : 'inline-source-map',
  // the bundled dex catalog is large by design and loads from disk, not a network
  performance: { hints: false },
  devServer: {
    // loopback only: nothing on the network needs it, and it spares a Windows Firewall prompt
    host: 'localhost',
    hot: true,
    port: 9898,
    static: 'public/',
  },
  mode: PRODUCTION ? 'production' : 'development',
  module: {
    rules: [
      { test: /\.[jt]sx?$/, loader: 'babel-loader', exclude: /node_modules/ },
      {
        test: /\.scss$/,
        use: [
          'style-loader',
          { loader: 'css-loader', options: { url: false } },
          { loader: 'sass-loader', options: { api: 'modern' } },
        ],
      },
    ],
  },
  plugins: [
    new HtmlWebpackPlugin({ template: './app/index.html', filename: 'index.html', inject: 'body' }),
    new Webpack.DefinePlugin({
      'process.env.TSUKAMAE_FRESH': JSON.stringify(env.fresh ? '1' : ''),
    }),
  ],
});
