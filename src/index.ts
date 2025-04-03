import * as Vue from 'vue';
import * as ytdl from '@distube/ytdl-core';

import { AppState } from './model';
import { Playlist } from './playlist';

import App from './components/app.vue';
import './yt.css';

import { YouTubeSearch } from './search/yapi';
import { MDFindSearch } from './search/local-files';
import { ClientPlayerControls, ClientPlayerCore, 
         ClientSearch, ClientSleepTimer } from './client';
import { YtdlPlayerCore, YtdlPlayerInPageCore } from './player';

import { VolumeControlAS } from './desktop/volume-mac';
import { Server } from './desktop/server';
import { AndroidAppPlayerControls, SleepTimer } from './controls';

import './infra/polyfill';
import { YouTubeTestRun } from './testrun';


Object.assign(window, {Playlist, ytdl, VolumeControlAS});


var playerCore: any, controls: any, app: any, yapi: any;
declare var mainActivity: any;


async function main() {
    /*
    let tr = new YouTubeTestRun('L5Ij7z1xh1M');
    tr.go();
    Object.assign(window, {tr});
    */

    app = Vue.createApp(App, {state: Vue.reactive(new AppState())}).mount('#app');

    playerCore = new YtdlPlayerInPageCore;
    yapi = new YouTubeSearch;

    var SEARCH_SCOPES = {yapi, local: new MDFindSearch, client: new ClientSearch, default: yapi},
        server: Server;
        
    if (typeof mainActivity !== 'undefined') {       /* In Android WebView */
        playerCore = new YtdlPlayerCore();
        controls = new AndroidAppPlayerControls();
        app.state.sleep = new SleepTimer(40);
    }
    else if (Server?.isAvailable()) {             /* In NWjs standalone app */
        server = new Server();

        controls = server.controls;
        server.state = app.state;

        app.state.sleep = new SleepTimer(40);
    }
    else {                                       /* In client browser */
        SEARCH_SCOPES.default = SEARCH_SCOPES.client;
        playerCore = new ClientPlayerCore;
        controls = new ClientPlayerControls;
        app.state.sleep = new ClientSleepTimer(40);
    }
    
    Object.assign(window, {app, playerCore, controls, yapi, SEARCH_SCOPES, server});

    app.state.volume = await controls.volume.delegate();

    window.addEventListener('message', msg => {
        console.log("message: " + JSON.stringify(msg), msg.data);
        if (typeof msg.data === 'string')
            action(JSON.parse(msg.data));    
    });
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