import { Playlist } from './playlist';
import { PlayerControls, VolumeControl, SleepTimer } from './controls';
import { YoutubeItem } from './player';
import { Track } from './model';


class Client {

    server: string
    verbose = true

    constructor(server: string) {
        this.server = server;
    }

    async action(cmd: string | object, path?: string, responseType?: 'text', method?: string): Promise<string>;
    async action(cmd: string | object, path?: string, responseType?: 'json', method?: string): Promise<object>;

    async action(cmd: string | object, path='/', responseType='text', method?: string): Promise<object | string> {
        var verbose = this.verbose;

        if (typeof cmd === 'string') {
            if (cmd.startsWith('vol') || cmd === 'status') verbose = false;
            if (!method) method = cmd.includes('?') ? 'POST' : 'GET';
            path = '/' + cmd; cmd = undefined;
        }
        else if (!method) { method = 'POST'; }

        if (verbose) console.log(cmd ?? path);

        var url = `${this.server}${path}`,
            ok = (data: any) => (verbose && console.log('ok', data), data);

        let req = await fetch(url, {
            method,
            headers: {'Content-Type': JSON_CT},
            body: cmd && JSON.stringify(cmd)
        });

        try {
            switch (responseType) {
                case 'json': return ok(await req.json());
                default:     return ok(await req.text());
            }
        }
        catch (e) {
            console.error(req, e);
            throw e;
        }

        /*
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
        */
    }
}

const JSON_CT = 'text/json; charset=utf-8';


const client = new Client(localStorage['tube.server'] ?? "");


class ClientSearch {
    search(query) {
        return client.action({type: 'search', text: query}, '/', 'json');
    }
    details(videoId) {
        return client.action({type: 'details', videoId}, '/', 'json');
    }
}

class ClientPlayerCore {
    upload: ClientUploads

    constructor() {
        this.upload = new ClientUploads(this);
    }

    async watch(url) {
        var status = await client.action({type: 'watch', url});
        if (status !== 'ok') throw new Error(status);
    }
    async watchFromList(playlist) {
        var status = await client.action(playlist, '/playlist');
        if (status !== 'ok') throw new Error(status);
    }
    enqueue(tracks, anew = false) {
        if (!Array.isArray(tracks)) tracks = [tracks];
        return client.action({tracks}, `/playlist?enqueue${anew ? '&anew' : ''}`);
    }
    async uploadAndPlay(file, progress, name = 'c') {
        this.watch((await this.upload.file(file, progress, name)).uri);
    }
    async uploadAndEnqueue(file, progress, name = 'c') {
        this.enqueue(await this.upload.file(file, progress, name));
    }
    playlists() {
        return client.action('playlists', null, 'json');
    }
    playlistGet(id) {
        return client.action(`playlists/${id}`).then(Playlist.from);
    }
}


class ClientPlayerControls implements PlayerControls {
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
        client.action('status', null, 'json').then(cb);
    }
    getPosition(cb) {
        client.action('pos').then(function(res) {
            var pos_dur = res.split('/');
            cb({pos: +pos_dur[0], duration: +pos_dur[1]});
        });
    }
    seek(pos) {
        if (pos)
            client.action(`pos?${pos}`);
    }
    resume() { client.action('resume'); return true; }
    pause() { client.action('pause'); return true; }
}


class ClientVolumeControl extends VolumeControl {
    async get() { return this._rescale(await this._get()); }

    async _get() {
        let vol = await client.action('vol');
        var mo = vol.match(/^(\d+)[/](\d+)/);
        return mo ? {level: +mo[1], max: +mo[2]} : null;
    }

    async set(level: number, max?: number) {
        max ??= this.max;
        await client.action('vol?' + Math.round(level) + '/' + Math.round(max));
    }

    get max(): number {
        return 1000; /** @oops must be the same as in the server's `app.state.volume` */
    }

    _rescale(vol?: {level: number, max: number}) {
        return vol ? vol.level * this.max / vol.max : undefined;
    }
}


class ClientSleepTimer extends SleepTimer {
    _isRunning: boolean = false

    get isRunning(): boolean {
        return this._isRunning;
    }

    start() { client.action('sleep/start'); this._isRunning = true; }
    stop()  { client.action('sleep/stop');  this._isRunning = false; }
}


class ClientUploads {
    client: ClientPlayerCore
    remoteTracks: Map<string, any>
    remoteKeys: string[]

    constructor(client) {
        this.client = client;
        this.remoteTracks = new Map();
        this.remoteKeys = [];  // list of keys in `remoteTracks` (for Vue)
    }

    async file(file, progress, name = 'c') {
        console.log(`%cupload %c${file.name} [${file.type}]`, "color: #f99", "color: #f33");
        var server = client.server,
            host = server == "" ? undefined : new URL(server).host,
            w = new WebSocketConnection(`cache/${name}`, host);
        if (progress) w.uploadProgress = progress;
        await w.upload(file);
        console.log('%cupload finished.', "color: #f99"); 
        return {id: name, kind: 2, uri: `file:///music/${name}`};
    }

    /**
     * 
     * @param {Array} tracks list of tracks to upload
     * @param {Function} progress
     *  upload progress callback; `({total, uploaded}, title) => void`
     * @param {*} startIndex index of first track (tracks[0]) in playlist
     * @param {*} force `true` to upload even if track has been previously 
     *  uploaded. (default `false`)
     * @param {*} play `'play'` to start playing once first track is uploaded;
     *  `'enqueue'` to add to the end of the current play queue (if any);
     *  `undefined` (the default) to just upload.
     */
    async tracks(tracks, progress, startIndex = 0, force = false, play = undefined) {
        var i = startIndex, start = (play === 'play'),
            uploadProgress = (p) => p && progress(p);
        for (let track of tracks) {
            let id = YoutubeItem.id(track);
            if ((force || !this.remoteTracks.get(id)) && 
                YoutubeItem.kind(track) == Track.Kind.LOCAL) {
                var title = YoutubeItem.title(track) || 'untitled',
                    ufile = new File(track.uri.replace(/^file:\/\//, ''), title);

                progress({}, title);
                this._set(track.id,
                    await this.file(ufile, uploadProgress, `c${i}`));
            }
            if (play) {
                await this._play(track, start);
                start = false; // next one will enqueue
            }
            i++;
        }
        progress(undefined); // clear progress
    }

    _play(track, start: boolean) {
        let id = YoutubeItem.id(track),
            item = this.remoteTracks.get(id) || track;
        if (!item.uri) item = {...item, uri: id};
        return this.client.enqueue(item, start);
    }

    _set(key, value) {
        this.remoteTracks.set(key, value);
        if (!this.remoteKeys.includes(key)) this.remoteKeys.push(key);
    }
}

/**
 * Communicating with the server via WebSocket, for status and
 * file uploads.
 */
class WebSocketConnection {
    ws: WebSocket
    uploadProgress = (_: {total: number, uploaded: number}) => {}
    uploadSize: number

    constructor(path, host=location.host) {
        this.ws = new WebSocket(`ws://${host}/${path}`);
    }

    async upload(file: File) {
        var error: Event = undefined;
        this.uploadSize = file.size;
        try {
            await new Promise<void>((resolve, reject) => {
                this.ws.onopen = () => this.sendChunked(file);
                this.ws.onerror = e => { error = e; reject(e); };
                this.ws.onclose = () => !error && resolve();
            });
        } finally {
            this.uploadProgress(undefined); // clear progress
        }
    }

    async sendChunked(file: File) {
        var ws = this.ws;
        this.monitorProgress();
        
        try {
            await new Response(file).body.pipeTo(
                new WritableStream({
                    write(buf) { ws.send(buf); },
                })
            );
        }
        finally {
            ws.close();
        }
    }

    monitorProgress() {
        var ws = this.ws;
        var iv = setInterval(() => {
            console.log(ws.bufferedAmount); 
            var uploaded = Math.max(0, this.uploadSize - ws.bufferedAmount);
            this.uploadProgress({total: this.uploadSize, uploaded})
        }, 500);
        ws.addEventListener('close', function() { clearInterval(iv); });
    }
}


export { ClientSearch, ClientPlayerCore, ClientPlayerControls, 
         ClientVolumeControl, ClientSleepTimer }