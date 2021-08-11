
/* yapi proxy */

var SERVER = ""
var JSON_CT = 'text/json; charset=utf-8'

function server_action(cmd, path='/', responseType='text', method) {
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
            reject(jq.responseJSON || jq.response);
         });
    });
}

class ClientYouTubeSearch {
    search(query) {
        return server_action({type: 'search', text: query}, '/', 'json');
    }
    details(videoId) {
        return server_action({type: 'details', videoId}, '/', 'json');
    }
}

class ClientPlayerCore {
    constructor() { this.upload = new ClientUploads(this); }

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
    getVolume(cb) {
        server_action('vol').then(function(res) {
            var mo = res.match(/^(\d+)[/](\d+)/);
            if (mo) cb({level: +mo[1], max: +mo[2]})
        });
    }
    setVolume(level, max) {
        server_action('vol?' + Math.round(level) + '/' + Math.round(max));
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


class ClientUploads {
    constructor(client) {
        this.client = client;
        this.remoteTracks = new Map();
        this.remoteKeys = [];  // list of keys in `remoteTracks` (for Vue)
    }

    async file(file, progress, name = 'c') {
        console.log(`%cupload %c${file.name} [${file.type}]`, "color: #f99", "color: #f33");
        var host = SERVER.length ? new URL(SERVER).host : undefined,
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
                YoutubeItem.kind(track) == Playlist.KIND.LOCAL) {
                var title = YoutubeItem.title(track) || 'untitled',
                    ufile = new File(track.uri.replace(/^file:\/\//, ''), title);

                progress({}, title);
                this._set(track.id,
                    await this.file(ufile, uploadProgress, `c${i}`));
            }
            if (play) {
                this._play(track, start);
                start = false; // next one will enqueue
            }
            i++;
        }
        progress(undefined); // clear progress
    }

    _play(track, start) {
        let id = YoutubeItem.id(track),
            item = this.remoteTracks.get(id) || track;
        start ? this.client.watch(item.uri || id)
              : this.client.enqueue(item);
    }

    _set(key, value) {
        this.remoteTracks.set(key, value);
        if (!this.remoteKeys.includes(key)) this.remoteKeys.push(key);
    }
}


function play(mediaUrl) {
    $('#video-area').html(
        $('<video>').attr('controls', true)
            .append($('<source>').attr('src', mediaUrl)));
}

/**
 * Communicating with the server via WebSocket, for status and
 * file uploads.
 */
class WebSocketConnection {

    constructor(path, host=location.host) {
        this.ws = new WebSocket(`ws://${host}/${path}`);
        this.uploadProgress = ({total, uploaded}) => {};
    }

    upload(file) {
        var self = this, error;
        this.uploadSize = file.size;
        return new Promise(function(resolve, reject) {
            self.ws.onopen = () => self.sendChunked(file);
            self.ws.onerror = e => { error = e; reject(e); }
            self.ws.onclose = () => !error && resolve();
        }).finally(() => this.uploadProgress(undefined));  // clear progress
    }

    sendChunked(file) {
        var ws = this.ws;
        var out = new WritableStream({
            write (buf) { ws.send(buf); },
        });
        this.monitorProgress();

        return new Response(file).body.pipeTo(out)
            .finally(function() { ws.close(); });
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
