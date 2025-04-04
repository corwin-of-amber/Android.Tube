const path = require('path'),
      webpack = require('webpack');
const { VueLoaderPlugin } = require('vue-loader');


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

const base = [
  {
    test: /\.tsx?$/,
    loader: 'ts-loader',
    options: {
        appendTsSuffixTo: [/\.vue$/],
        transpileOnly: true
    }
  },
  {
    test: /\.css$/i,
    use: ['style-loader', 'css-loader'],
  },
  {
    test: /\.scss$/i,  /* Vue.js has some */
    use: ['style-loader', 'css-loader', 'sass-loader'],
  },
  {
    test: /\.(png|jpe?g|gif|svg)$/i,
    type: 'asset/resource',
    generator: {
        filename: 'img/[hash][ext][query]'
    }
  }];

const vue = {
    test: /\.vue$/,
    use: 'vue-loader'
  };

const ytdl = {
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
      // this is only needed as long as `@distube/ytdl-core` is `npm link`ed
      '@babel/runtime': path.resolve(__dirname, 'node_modules/@babel/runtime'),
    }
  },
  plugins: [
    new webpack.ProvidePlugin({
      Buffer: ['buffer', 'Buffer'],
    })
  ]
};


const app = {
  entry: './src/index.ts',
  mode: 'production', //'development',
  devtool: false, //inline-source-map',
  output: {
    filename: 'android.js',
    path: path.resolve(__dirname, 'app/src/main/assets/js/build'),
  },
  module: {
    rules: [
      ...base, vue, babel
    ],
  },
  resolve: {
    extensions: ['.tsx', '.ts', '.js'],
    fallback: {
      ...ytdl.resolve.fallback,

      //tty: false, os: false, net: false,
      child_process: false,  /* because macOS sleep is hard-coded  :( */
      path: require.resolve("path-browserify"),
      //crypto: require.resolve("crypto-browserify"),
      assert: require.resolve("assert/"),
      util: require.resolve("util/"),
      url: require.resolve("url/"),
      events: require.resolve("events/")
    }      
  },
  externals: {
    './desktop/volume-mac': '{}',
    './desktop/server': '{}',
    // this is for regex-translator's CLI so it can probably go away
    // if it is only used at build time, as it should
    'winston': '{}', 'wordwrap': '{}', 'table-layout': '{}', 'env-paths': '{}', 'command-line-usage': '{}', 
    'application-log-winston-interface': '{}',
  },
  plugins: [
    new VueLoaderPlugin(),
    new webpack.DefinePlugin({
      'process': {browser: true, env: {YTDL_NO_UPDATE: 1}},
      __VUE_OPTIONS_API__: true,
      __VUE_PROD_DEVTOOLS__: true,
      __VUE_PROD_HYDRATION_MISMATCH_DETAILS__: false
    }),
    ...ytdl.plugins
  ]
}

module.exports = [app]