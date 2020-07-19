
/* yapi proxy */

var SERVER = ""
var JSON_CT = 'text/json; charset=utf-8'

function server_action(cmd, path='/', responseType='text') {
    console.log(cmd);

    if (typeof cmd === 'string') {
        if (cmd.includes('?'))
            return $.post({url: `${SERVER}/${cmd}`});
        else
            return $.get({url: `${SERVER}/${cmd}`});
    }

    var url = `${SERVER}${path}`;
    return new Promise(function(resolve, reject) {
        $.post({url: url, data: JSON.stringify(cmd), contentType: JSON_CT, dataType: responseType})
        .done(function(data) { console.log('ok', data); resolve(data); })
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
}

class ClientPlayerControls {
    getVolume(cb) {
        server_action('vol').then(function(res) {
            var mo = res.match(/^(\d+)[/](\d+)/);
            if (mo) cb({level: +mo[1], max: +mo[2]})
        });
    }
    setVolume(level, max) {
        server_action('vol?' + level + '/' + max);
    }
    getStatus(cb) {
        server_action('status').then(cb);
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
    }

    upload(file) {
        var self = this;
        return new Promise(function(resolve) {
            self.ws.onopen = function() { self.sendChunked(file); }
            self.ws.onclose = function() {
                console.log('%cupload finished.', "color: #f99"); 
                resolve('file:///music/a');  // TODO
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
        var iv = setInterval(function() { console.log(ws.bufferedAmount); }, 500);
        ws.addEventListener('close', function() { clearInterval(iv); });
    }
}
