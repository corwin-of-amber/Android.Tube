import * as Vue from 'vue/dist/vue';

// @ts-ignore
import contextMenu from './components/app-context-menu.vue';

Object.assign(window, {Vue, AppContextMenu: contextMenu});