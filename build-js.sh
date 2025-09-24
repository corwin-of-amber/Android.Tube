#!/bin/bash

webpack

#mkdir -p app/src/main/assets/js/lib

#npx browserify app/src/main/js/ytdl.js -o app/src/main/assets/js/lib/ytdl.browser.js \
#   --global-transform [ babelify --presets [ @babel/preset-env ] \
#   --plugins [ @babel/plugin-transform-object-assign ] ]

# alternative build method. needs more testing
buildWithKremlin() {
   rm -rf build/kremlin/android
   kremlin -o build/kremlin/android -p src/index.ts

   npx babel --no-babelrc --presets @babel/preset-env \
      build/kremlin/android/index.js > ./app/src/main/assets/js/build/android.js

   cat build/kremlin/android/*.css > app/src/main/assets/css/build/app.css
}

#cp -f node_modules/jquery/dist/jquery.min.js   \
#      node_modules/lodash/lodash.min.js        \
#      node_modules/vue/dist/vue.min.js         \
#      app/src/main/assets/js/lib/