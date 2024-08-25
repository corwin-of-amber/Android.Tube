import * as Vue from 'vue';
import { Playlist } from './playlist';

import App from './components/app.vue';
import './yt.css';

import { YouTubeSearch } from './yapi';

Object.assign(window, {Playlist, __VUE_PROD_HYDRATION_MISMATCH_DETAILS__: false});


async function main() {
    let app = Vue.createApp(App, {data: Playlist.restore()}).mount(document.querySelector('#ui-container'));

    let yapi = new YouTubeSearch, SEARCH_SCOPES = {};

    Object.assign(window, {app, yapi, SEARCH_SCOPES});
}

document.addEventListener('DOMContentLoaded', main);