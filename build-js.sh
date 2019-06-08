#!/bin/bash

mkdir -p app/src/main/assets/js/lib

npx browserify app/src/main/js/ytdl.js -o app/src/main/assets/js/lib/ytdl.browser.js \
   --global-transform [ babelify --presets [ @babel/preset-env ] \
   --plugins [ @babel/plugin-transform-object-assign ] ]

cp -f node_modules/jquery/dist/jquery.min.js   \
      node_modules/lodash/lodash.min.js        \
      node_modules/vue/dist/vue.min.js         \
      app/src/main/assets/js/lib/