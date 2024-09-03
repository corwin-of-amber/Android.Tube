import * as Vue from 'vue';
import * as ytdl from '@distube/ytdl-core';

import { AppState } from './model';
import { Playlist } from './playlist';

import App from './components/app.vue';
import './yt.css';

import { YouTubeSearch } from './search/yapi';
import { MDFindSearch } from './search/local-files';
import { YtdlPlayerInPageCore } from './player';

import { VolumeControlAS } from './desktop/volume-mac';
import { Server } from './desktop/server';


Object.assign(window, {Playlist, ytdl, VolumeControlAS});


var playerCore: any, app: any, yapi: any, mainActivity: any;


async function main() {
    app = Vue.createApp(App, {state: Vue.reactive(new AppState())}).mount('#app');

    playerCore = new YtdlPlayerInPageCore;
    yapi = new YouTubeSearch;

    var SEARCH_SCOPES = {yapi, local: new MDFindSearch, default: yapi},
        server = new Server();

    app.state.volume = await server.controls.volume.delegate();

    /*
    server.controls.getVolume(function(vol) {
        console.log(vol);
        let self = app.$refs.volume;
        self.level = vol.level * self.max / vol.max;
    });
    */


    Object.assign(window, {app, playerCore, yapi, SEARCH_SCOPES, server});
}

function action(cmd, opts?) {
    switch (cmd.type) {
    case 'watch':    return playerCore.watch(cmd.url, opts);
    case 'search':   return app.search(cmd.text, opts);
    case 'details':  return yapi.details(cmd.videoId);
    case 'playlist': app.openPlaylist(cmd.data); return Promise.resolve();
    case 'request':
        var id = cmd.id;
        action(cmd.inner).then(function(res) {
            mainActivity.postResponse(id, res ? JSON.stringify(res) : "ok");
        })
        .catch(function(e) { mainActivity.postResponse(id, JSON.stringify({error: e, msg: e.toString()})); });
        break;
    default:
        var errmsg = "unknown command '" + cmd.type + "'";
        console.error(errmsg);
        return Promise.reject(errmsg);
    }
}


document.addEventListener('DOMContentLoaded', main);


export { action }