import $ from 'jquery';
import { Playlist } from './playlist';
import { VolumeControl } from './controls';


/* yapi proxy */

var SERVER = ""
var JSON_CT = 'text/json; charset=utf-8'

function server_action(cmd, path='/', responseType='text', method?: string): Promise<string> {
    console.log(cmd);

    var verbose = true;

    if (typeof cmd === 'string') {
        if (!method) method = cmd.includes('?') ? 'POST' : 'GET';
        path = '/' + cmd; cmd = undefined;
        verbose = false;
    }
    else if (!method) { method = 'POST'; }

    var url = `${SERVER}${path}`;
    return new Promise(function(resolve, reject) {
        $.ajax({
            method, url, data: cmd && JSON.stringify(cmd), 
            contentType: JSON_CT, dataType: responseType
        })
        .done(function(data) { verbose && console.log('ok', data); resolve(data); })
        .fail(function(jq, status, err) { console.error(jq, status, err);
            reject(jq.responseJSON || jq.responseText);
         });
    });
}

class ClientSearch {
    search(query) {
        return server_action({type: 'search', text: query}, '/', 'json');
    }
    details(videoId) {
        return server_action({type: 'details', videoId}, '/', 'json');
    }
}

class ClientPlayerCore {
    upload: any

    constructor() { /*this.upload = new ClientUploads(this);*/ }

    async watch(url) {
        var status = await server_action({type: 'watch', url});
        if (status !== 'ok') throw new Error(status);
    }
    async watchFromList(playlist) {
        var status = await server_action(playlist, '/playlist');
        if (status !== 'ok') throw new Error(status);
    }
    enqueue(tracks) {
        if (!Array.isArray(tracks)) tracks = [tracks];
        return server_action({tracks}, '/playlist?enqueue');
    }
    async uploadAndPlay(file, progress, name = 'c') {
        this.watch((await this.upload.file(file, progress, name)).uri);
    }
    async uploadAndEnqueue(file, progress, name = 'c') {
        this.enqueue(await this.upload.file(file, progress, name));
    }
    playlists() {
        return server_action('playlists', null, 'json');
    }
    playlistGet(id) {
        return server_action(`playlists/${id}`).then(Playlist.from);
    }
}


class ClientPlayerControls {
    volume = new ClientVolumeControl

    /** @deprecated */
    async getVolume(cb) {
        let r = await this.volume._get();
        if (r) cb(r);
    }
    setVolume(level, max) {
        this.volume.set(level, max);
    }
    getStatus(cb) {
        server_action('status', null, 'json').then(cb);
    }
    getPosition(cb) {
        server_action('pos').then(function(res) {
            var pos_dur = res.split('/');
            cb({pos: +pos_dur[0], duration: +pos_dur[1]});
        });
    }
    seek(pos) {
        if (pos)
            server_action(`pos?${pos}`);
    }
    resume() { server_action('resume'); return true; }
    pause() { server_action('pause'); return true; }
}


class ClientVolumeControl extends VolumeControl {
    async get() { return this._rescale(await this._get()); }

    async _get() {
        let vol = await server_action('vol');
        var mo = vol.match(/^(\d+)[/](\d+)/);
        return mo ? {level: +mo[1], max: +mo[2]} : null;
    }

    async set(level: number, max?: number) {
        max ??= this.max;
        await server_action('vol?' + Math.round(level) + '/' + Math.round(max));
    }

    get max(): number {
        return 1000; /** @oops must be the same as in the server's `app.state.volume` */
    }

    _rescale(vol?: {level: number, max: number}) {
        return vol ? vol.level * this.max / vol.max : undefined;
    }
}


export { ClientSearch, ClientPlayerCore, ClientPlayerControls, ClientVolumeControl }