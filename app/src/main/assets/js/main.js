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


function watch(urlOrId) {
    if (typeof server_action !== 'undefined') {
        server_action({type: 'watch', url: urlOrId}).then(function(status) {
            console.log(status);
            if (status !== 'ok') throw new Error(status);
        });
    }
    else {
        return getWatchUrl(urlOrId).then(function(webm) {
            if (typeof mainActivity === 'undefined')
                play(webm.url, webm.mimeType);
            else
                mainActivity.receivedUrl(urlOrId, webm.type, webm.url);
        });
    }
}

function getWatchUrl(urlOrId) {
    console.log(urlOrId, ytdl.validateID(urlOrId) || ytdl.validateURL(urlOrId));
    if (ytdl.validateID(urlOrId) || ytdl.validateURL(urlOrId))
        return getStream(urlOrId);
    else return Promise.resolve({url: urlOrId, type: 'unknown'});
}

function getStream(youtubeUrl, type) {
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

function play(mediaUrl, mediaType) {
    console.log(mediaType);
    var v = $('<audio>').attr('controls', true);
    v.append($('<source>').attr('src', mediaUrl));
    $('#video-area').html(v);
}

var lastSearchResults = undefined;

function showSearchResults(results) {
    lastSearchResults = results;
    $('body').empty();
    for (let item of results.items) {
        if (item.id.kind === 'youtube#video') {
            var p = $('<p>').html(item.snippet.title);
            p.click(function() {
                watch(item.id.videoId);
            });
            $('body').append(p);
        }
    }
}

function action(cmd) {
    switch (cmd.type) {
    case 'watch':    return watch(cmd.url); break;
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
