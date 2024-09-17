import * as Vue from 'vue';
import * as ytdl from '@distube/ytdl-core';

import { AppState } from './model';
import { Playlist } from './playlist';

import App from './components/app.vue';
import './yt.css';

import { YouTubeSearch } from './search/yapi';
import { MDFindSearch } from './search/local-files';
import { ClientPlayerControls, ClientPlayerCore, ClientSearch } from './client';
import { YtdlPlayerInPageCore } from './player';

import { VolumeControlAS } from './desktop/volume-mac';
import { Server } from './desktop/server';


Object.assign(window, {Playlist, ytdl, VolumeControlAS});


var playerCore: any, controls: any, app: any, yapi: any, mainActivity: any;


async function main() {
    app = Vue.createApp(App, {state: Vue.reactive(new AppState())}).mount('#app');

    playerCore = new YtdlPlayerInPageCore;
    yapi = new YouTubeSearch;

    var SEARCH_SCOPES = {yapi, local: new MDFindSearch, client: new ClientSearch, default: yapi},
        server: Server;
        
    if (Server.isAvailable()) {
        server = new Server();

        controls = server.controls;
        server.state = app.state;
    }
    else {
        SEARCH_SCOPES.default = SEARCH_SCOPES.client;
        playerCore = new ClientPlayerCore;
        controls = new ClientPlayerControls;
    }

    app.state.volume = await controls.volume.delegate();

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