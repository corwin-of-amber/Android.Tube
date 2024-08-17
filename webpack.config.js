const path = require('path'),
      webpack = require('webpack');


const babel = {
    test: /\.js$/,
    exclude: /node_modules\/@babel/,
    use: {
      loader: 'babel-loader',
      options: {
        presets: ['@babel/env'],
        plugins: [/*'@babel/transform-runtime',*/ '@babel/transform-object-assign']
      }
    }
  };

module.exports = {
  entry: './app/src/main/js/ytdl.js',
  mode: 'production',
  devtool: false, //inline-source-map',
  output: {
    filename: 'ytdl.browser.js',
    path: path.resolve(__dirname, 'app/src/main/assets/js/lib'),
  },
  module: {
    rules: [babel]
  },
  resolve: {
    fallback: {
      fs: false, https: false, http: false, string_decoder: false,
      stream: require.resolve('stream-browserify'),
      vm: require.resolve('vm-browserify'),
      querystring: require.resolve('querystring-es3'),
      timers: require.resolve('timers-browserify'),
      buffer: require.resolve('buffer/'),
      // this is only needed as long as `@distube/ytdl-core` is linked
      '@babel/runtime': path.resolve(__dirname, 'node_modules/@babel/runtime')
    }
  },
  plugins: [
    new webpack.ProvidePlugin({
      Buffer: ['buffer', 'Buffer'],
    })
  ]
};