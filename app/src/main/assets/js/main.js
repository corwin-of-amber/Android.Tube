'use strict';

const key = 'AIzaSyAa8yy0GdcGPHdtD083HiGGx_S0vMPScDM',
      api_endpoint = 'https://content.googleapis.com/youtube/v3',
      api_origin = 'https://explorer.apis.google.com';


function search(query) {
    var url=`${api_endpoint}/search?maxResults=25&part=snippet&q=${query}&key=${key}`;
    return new Promise(function(resolve, reject) {
        $.getJSON({url: url, headers: {'X-Origin': api_origin}})
        .done(function(data) { resolve(data); })
        .fail(function(jq) { reject(jq.responseJSON); });
    });
}

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
                if (!webm && format.type.startsWith('video/webm;')) webm = format;
            }

            webm = info.formats[0];

            if (webm) {
                //play(info.formats[0].url);
                mainActivity.receivedUrl(youtubeUrl, webm.type, webm.url);
            }
        }
    });
}

function play(mediaUrl) {
    var v = $('<video>').attr('controls', true),
        b = $('<button>').text("<");
    v.append($('<source>').attr('src', mediaUrl).attr('type', 'video/mp4'));
    b.click(function() {
        showSearchResults(lastSearchResults || []);
    });
    $('body').empty().append(v, b);
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
    case 'search': search(cmd.text).then(showSearchResults); break;
    }
};
/*watch('https://www.youtube.com/watch?v=mBnkvdM56XQ');*/
