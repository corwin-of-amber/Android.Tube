import * as Vue from 'vue/dist/vue';

// @ts-ignore
import contextMenu from './components/app-context-menu.vue';

import { TrackSplitInfo } from './tracks';

Object.assign(window, {Vue, AppContextMenu: contextMenu, TrackSplitInfo});