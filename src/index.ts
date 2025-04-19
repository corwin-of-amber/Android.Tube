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
import { AndroidAppPlayerControls, InPagePlayerControls, SleepTimer } from './controls';

import './infra/polyfill';
import { YouTubeTestRun } from './testrun';


Object.assign(window, {Playlist, ytdl, VolumeControlAS});


var app: any, playerCore: any, yapi: any;
declare var mainActivity: any;


async function main() {
    /*
    let tr = new YouTubeTestRun('L5Ij7z1xh1M');
    tr.go();
    Object.assign(window, {tr});
    */

    app = Vue.createApp(App, {state: Vue.reactive(new AppState())}).mount('#app');

    yapi = new YouTubeSearch;

    var SEARCH_SCOPES = {yapi, local: new MDFindSearch, client: new ClientSearch, default: yapi},
        server: Server;
        
    if (typeof mainActivity !== 'undefined') {       /* In Android WebView */
        playerCore = new YtdlPlayerCore();
        app.controls = new AndroidAppPlayerControls();
        app.state.sleep = new SleepTimer(40);
    }
    else if (Server?.isAvailable()) {             /* In NWjs standalone app */
        playerCore = new YtdlPlayerInPageCore();
        app.controls = new InPagePlayerControls(new VolumeControlAS);
        app.state.sleep = new SleepTimer(40);

        server = new Server();
        server.state = app.state;
        server.controls = Vue.toRaw(app.controls);
    }
    else {                                       /* In client browser */
        SEARCH_SCOPES.default = SEARCH_SCOPES.client;
        playerCore = new ClientPlayerCore;
        app.controls = new ClientPlayerControls;
        app.state.sleep = new ClientSleepTimer(40);
    }

    Object.assign(window, {app, playerCore, yapi, SEARCH_SCOPES, server});

    app.globalKeyMap().attach(document.body);

    window.addEventListener('message', msg => {
        console.log("message: " + JSON.stringify(msg), msg.data);
        if (typeof msg.data === 'string')
            action(JSON.parse(msg.data));    
    });
}

async function action(cmd, opts?) {
    switch (cmd.type) {
    case 'watch':    return playerCore.watch(cmd.url, opts);
    case 'search':   return app.search(cmd.text, opts);
    case 'details':  return yapi.details(cmd.videoId);
    case 'playlist':
        await app.openPlaylist(cmd.data, opts);
        return;
    case 'request':
        var id = cmd.id;
        try {
            let res = await action(cmd.inner);
            mainActivity.postResponse(id, res ? JSON.stringify(res) : "ok");
        }
        catch (e) {
            mainActivity.postResponse(id, JSON.stringify({error: e, msg: e.toString()}));
        }
        break;
    default:
        var errmsg = "unknown command '" + cmd.type + "'";
        console.error(errmsg);
        return Promise.reject(errmsg);
    }
}


document.addEventListener('DOMContentLoaded', main);


export { action }