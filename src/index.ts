import * as Vue from 'vue';
import * as ytdl from '@distube/ytdl-core';

import { Playlist } from './playlist';

import App from './components/app.vue';
import './yt.css';

import { YouTubeSearch } from './search/yapi';
import { YtdlPlayerInPageCore } from './player';


Object.assign(window, {Playlist, ytdl, __VUE_PROD_HYDRATION_MISMATCH_DETAILS__: false});


async function main() {
    let app = Vue.createApp(App, {data: Playlist.restore()}).mount(document.querySelector('#ui-container'));

    let player = new YtdlPlayerInPageCore,
        yapi = new YouTubeSearch,
        SEARCH_SCOPES = {yapi, default: yapi};

    Object.assign(window, {app, player, yapi, SEARCH_SCOPES});
}

document.addEventListener('DOMContentLoaded', main);