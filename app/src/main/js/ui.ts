import * as Vue from 'vue/dist/vue';

// @ts-ignore
import contextMenu from './components/app-context-menu.vue';

import { TrackSplit, TrackSplitInfo } from './tracks';
import { DroppedFiles } from './files';

Object.assign(window, {Vue, AppContextMenu: contextMenu,
    TrackSplit, TrackSplitInfo, DroppedFiles});