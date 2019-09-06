'use strict';

function watch(urlOrId) {
    return getWatchUrl(urlOrId).then(function(webm) {
        if (typeof mainActivity === 'undefined')
            play(webm.url);
        else
            mainActivity.receivedUrl(urlOrId, webm.type, webm.url);
    });
}

function getWatchUrl(urlOrId) {
    console.log(urlOrId, ytdl.validateID(urlOrId) || ytdl.validateURL(urlOrId));
    if (ytdl.validateID(urlOrId) || ytdl.validateURL(urlOrId)) return getStream(urlOrId);
    else return Promise.resolve({url: urlOrId, type: 'unknown'});
}

function getStream(youtubeUrl) {
    return new Promise(function(resolve, reject) {
        ytdl.getInfo(youtubeUrl, function (err, info) {
            if (err) {
                console.error('ytdl error:\n' + err);
                reject(err);
            }
            else if (info) {
                console.log('ytdl info:');
                console.log(`token = ${info.account_playback_token}`);
                var n = info.formats.length, i = 0, webm;
                for (let format of info.formats) {
                    i++;
                    console.log(`format #${i}/${n}: ${format.type}
                        '${format.url}'`);
                    if (!webm && format.type.startsWith('video/')) webm = format;
                }

                //webm = info.formats[0];

                if (webm) resolve(webm);
                else reject(`no video for '${youtubeUrl}'`);
            }
            else reject(`empty info for '${youtubeUrl}'`);
        });
    });
}

function play(mediaUrl) {
    var v = $('<video>').attr('controls', true),
        b = $('<button>').text("<");
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
        .catch(function(e) { mainActivity.postResponse(id, "error: " + e); });
        break;
    default:
        var errmsg = "unknown command '" + cmd.type + "'";
        console.error(errmsg);
        return Promise.reject(errmsg);
    }
}

window.onmessage = function(msg) {
    console.log("message: " + JSON.stringify(msg));
    action(JSON.parse(msg.data));
};
/*watch('https://www.youtube.com/watch?v=mBnkvdM56XQ');*/
