
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
    async watch(url) {
        var status = await server_action({type: 'watch', url});
        if (status !== 'ok') throw new Error(status);
    }
    async watchFromList(playlist) {
        var status = await server_action(playlist, '/playlist');
        if (status !== 'ok') throw new Error(status);
    }
    async upload(file, progress) {
        console.log(`%cupload %c${file.name} [${file.type}]`, "color: #f99", "color: #f33");
        var host = SERVER.length ? new URL(SERVER).host : undefined,
            w = new WebSocketConnection('cache/a', host);
        if (progress) w.uploadProgress = progress;
        await w.upload(file);
        console.log('%cupload finished.', "color: #f99"); 
        playerCore.watch('file:///music/a');
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
            self.ws.onopen = function() { self.sendChunked(file); }
            self.ws.onerror = function(e) { error = e; reject(e); }
            self.ws.onclose = function() {
                if (!error) { resolve(); }
            }
        });
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
            if (!this.uploadProgress) this.uploadProgress = ws.bufferedAmount;
            var uploaded = Math.max(0, this.uploadSize - ws.bufferedAmount);
            this.uploadProgress({total: this.uploadSize, uploaded})
        }, 500);
        ws.addEventListener('close', function() { clearInterval(iv); });
    }
}
