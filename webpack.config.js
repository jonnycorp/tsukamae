'use strict';

const HtmlWebpackPlugin = require('html-webpack-plugin');
const Webpack = require('webpack');

const PRODUCTION = process.env.NODE_ENV === 'staging' || process.env.NODE_ENV === 'production';

module.exports = {
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
  devServer: {
    setupMiddlewares: (middlewares, devServer) => {
      if (!devServer) {
        throw new Error('webpack-dev-server is not defined');
      }

      // This adds a fake route during development that returns the string
      // "development" for the /version endpoint. This will make it so that the
      // new version banner doesn't show up all the time.
      devServer.app.get('/version', (req, res) => {
        res.send('development');
      });

      return middlewares;
    },
    historyApiFallback: true,
    host: '0.0.0.0',
    hot: true,
    port: 9898,
    static: 'public/',
  },
  mode: PRODUCTION ? 'production' : 'none',
  module: {
    rules: [
      { test: /\.[jt]sx?$/, loader: 'babel-loader', exclude: /node_modules/ },
      {
        test: /\.scss$/,
        use: [
          'style-loader',
          { loader: 'css-loader', options: { url: false } },
          {
            loader: 'sass-loader',
            options: {
              api: 'modern',
              // The stylesheets still use the legacy `@import` and global color
              // functions (lighten/darken). These are deprecated but not yet
              // removed; silence the noise until they're migrated to `@use` /
              // `color.adjust`.
              sassOptions: {
                silenceDeprecations: ['import', 'global-builtin', 'color-functions'],
              },
            },
          },
        ],
      },
    ],
  },
  plugins: [
    new HtmlWebpackPlugin({ template: './app/index.html', filename: 'index.html', inject: 'body' }),
    new Webpack.DefinePlugin({
      'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV) || 'undefined',
      'process.env.VERSION': JSON.stringify(process.env.VERSION || 'development'),
      // When set (via `yarn start:fresh`), the app keeps progress in memory only
      // — nothing touches localStorage, so every launch/reload starts empty and
      // real saved data is never read or overwritten.
      'process.env.TSUKAMAE_FRESH': JSON.stringify(process.env.TSUKAMAE_FRESH || ''),
    }),
  ],
};
