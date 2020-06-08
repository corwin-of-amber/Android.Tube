'use strict';


var DEFAULT_MEDIA_TYPE = 'audio/';
/*    (typeof mainActivity !== 'undefined' || typeof server_action !== 'undefined')
        ? 'video/' : 'audio/';*/
var PREFERRED_FORMATS = [
    /^audio[/]webm; opus/
];

// polyfill
if (![].findIndex) {
    Array.prototype.findIndex = function(p) {
        for (var i = 0; i < p.length; i++)
            if (p(this[i])) return i;
        return -1;
    }
}
if (!Object.assign) {
    Object.assign = function (obj /*, ...*/) {
        for (let o of arguments) {
            if (o === obj) continue;
            for (let k in o) obj[k] = o[k];
        }
        return obj;
    };
}


class YtdlPlayerCore {
    watch(urlOrId) {
        var self = this;
        return this.getWatchUrl(urlOrId).then(
            function(webm) { self.playStream(urlOrId, webm); });
    }

    getWatchUrl(urlOrId) {
        console.log(urlOrId, ytdl.validateID(urlOrId) || ytdl.validateURL(urlOrId));
        if (ytdl.validateID(urlOrId) || ytdl.validateURL(urlOrId))
            return this.getStream(urlOrId);
        else return Promise.resolve({url: urlOrId, type: 'unknown'});
    }

    playStream(urlOrId, webm) {
        if (typeof mainActivity === 'undefined')
            playInPage(urlOrId, webm.url, webm.mimeType);
        else
            mainActivity.receivedUrl(urlOrId, webm.type, webm.url);
    }

    getStream(youtubeUrl, type) {
        type = type || DEFAULT_MEDIA_TYPE;
        return ytdl.getInfo(youtubeUrl).then(function (info) {
            if (!info) throw new Error(`empty info for '${youtubeUrl}'`);
    
            console.log('ytdl info:');
            console.log(`csn = ${info.csn}`);
            var n = info.formats.length, i = 0, webm, rank;
            for (let format of info.formats) {
                let ftype = format.mimeType;
                console.log(`format #${++i}/${n}: ${ftype}
                    '${format.url}'`);
                if (ftype && ftype.startsWith(type)) {
                    var r = PREFERRED_FORMATS.findIndex(
                                function(re) { return re.exec(ftype); });
                    if (!webm || r > rank) {
                        webm = format;
                        rank = r;
                    }
                }
            }
    
            if (webm) return webm;
            else throw new Error(`no stream for '${youtubeUrl}' (${type}*)`);
        })
        .catch(function(err) {
            console.error('ytdl error:\n' + err);
        });
    }    
}

var playerCore = new YtdlPlayerCore();


function playInPage(track, mediaUrl, mediaType) {
    console.log(mediaType);
    var a = $('<audio>').attr('controls', true);
    a.data('track', track);
    a.append($('<source>').attr('src', mediaUrl));
    $('#video-area').html(a);
}


function action(cmd) {
    switch (cmd.type) {
    case 'watch':    return playerCore.watch(cmd.url); break;
    case 'search':   return app.search(cmd.text); break;
    case 'details':  return yapi.details(cmd.videoId); break;
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

window.onmessage = function(msg) {
    console.log("message: " + JSON.stringify(msg));
    if (msg.data)
        action(JSON.parse(msg.data));
};
/*watch('https://www.youtube.com/watch?v=mBnkvdM56XQ');*/
