import * as Vue from 'vue';
import * as ytdl from '@distube/ytdl-core';

import { Playlist } from './playlist';

import App from './components/app.vue';
import './yt.css';

import { YouTubeSearch } from './search/yapi';
import { MDFindSearch } from './search/local-files';
import { YtdlPlayerInPageCore } from './player';


Object.assign(window, {Playlist, ytdl});


async function main() {
    let app = Vue.createApp(App, {data: Playlist.restore()}).mount('#app');

    let playerCore = new YtdlPlayerInPageCore,
        yapi = new YouTubeSearch,
        SEARCH_SCOPES = {yapi, local: new MDFindSearch, default: yapi};

    Object.assign(window, {app, playerCore, yapi, SEARCH_SCOPES});
}

document.addEventListener('DOMContentLoaded', main);