'use strict';

function watch(youtubeUrl) {
    ytdl.getInfo(youtubeUrl, function (err, info) {
        if (err) {
            console.err('ytdl error:\n' + err);
        }
        if (info) {
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

            if (webm) {
                if (typeof mainActivity === 'undefined')
                    play(webm.url);
                else
                    mainActivity.receivedUrl(youtubeUrl, webm.type, webm.url);
            }
        }
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

window.onmessage = function(msg) {
    console.log("message: " + JSON.stringify(msg));
    var cmd = JSON.parse(msg.data);
    switch (cmd.type) {
    case 'watch':  watch(cmd.url); break;
    case 'search': ui.search(cmd.text); break;

    //search(cmd.text).then(showSearchResults); break;
    }
};
/*watch('https://www.youtube.com/watch?v=mBnkvdM56XQ');*/
