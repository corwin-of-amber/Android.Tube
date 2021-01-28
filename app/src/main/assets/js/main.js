'use strict';


var DEFAULT_MEDIA_TYPE = '';  //  can be 'audio/' or 'video/'
var PREFERRED_FORMATS = [     //  most preferred first
    /^audio[/]mp4; codecs="mp4a.*"/,
    /^audio[/]webm; codecs="opus"/
];

// polyfill
if (![].findIndex) {
    Array.prototype.findIndex = function(p) {
        for (var i = 0; i < this.length; i++)
            if (p(this[i])) return i;
        return -1;
    }
}
if (![].find) {
    Array.prototype.find = function(p) {
        for (var i = 0; i < this.length; i++)
            if (p(this[i])) return this[i];
    }
}
if (![].includes) {
    Array.prototype.includes = function(el) {
        for (var i = 0; i < this.length; i++)
            if (this[i] === el) return true;
        return false;
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
if (!Object.values) {
    Object.values = function(o) { return Object.keys(o).map(function(k) { return o[k]; })};
}


class YtdlPlayerCore {
    constructor(preferredFormats) {
        this.preferredFormats = (preferredFormats || PREFERRED_FORMATS);
    }

    watch(urlOrId) {
        var self = this;
        return this.getWatchUrl(urlOrId).then(
            function(webm) { self.playStream(urlOrId, webm); })
            .catch(function(err) { console.error(err); });
    }

    watchFromList(playlistData) {
        if (typeof mainActivity === 'undefined')
            return this.watch(playlistData.tracks[playlistData.nowPlaying || 0].uri); // sorry
        else {
            mainActivity.playFromList(JSON.stringify(playlistData));
            return Promise.resolve();
        }
    }

    getWatchUrl(urlOrId, type, preferredFormats) {
        if (ytdl.validateID(urlOrId) || ytdl.validateURL(urlOrId))
            return this.getStream(urlOrId, type, preferredFormats);
        else return Promise.resolve({url: urlOrId, type: 'unknown'});
    }

    playStream(urlOrId, webm) {
        if (typeof mainActivity === 'undefined')
            playInPage(urlOrId, webm.url, webm.mimeType);
        else
            mainActivity.receivedUrl(urlOrId, webm.type, webm.url);
    }

    getStream(youtubeUrl, type, preferredFormats) {
        var self = this;
        type = type || DEFAULT_MEDIA_TYPE;
        preferredFormats = preferredFormats || this.preferredFormats;
        return ytdl.getInfo(youtubeUrl).then(function (info) {
            if (!info) throw new Error(`empty info for '${youtubeUrl}'`);
    
            console.log('ytdl info:');
            console.log(`csn = ${info.csn}`);
            var n = info.formats.length, i = 0, webm, rank;
            for (let format of info.formats) {
                let ftype = format.mimeType;
                console.log(`format #${++i}/${n}: ${ftype}\n` +
                    `        '${format.url}'`);
                if (!format.url) {
                    console.warn(`        missing url (${JSON.stringify(format)})`);
                    continue;
                }
                if (ftype && ftype.startsWith(type)) {
                    var r = preferredFormats.findIndex(
                                function(re) { return re.exec(ftype); });
                    if (r < 0) r = Infinity;
                    if (!webm || r < rank) {
                        webm = format;
                        rank = r;
                    }
                }
            }

            if (!webm) throw new Error(`no stream for '${youtubeUrl}' (${type}*)`);

            console.log(`selected format: ${webm.mimeType}`);
            return webm;
        })
        .catch(function(err) {
            console.error('ytdl error:\n' + err);
            throw err;
        })
        .then(function(webm) {
            // Parse MPD
            if (webm.url.match(/^https?:[/][/]manifest/)) {
                return self.getStreamFromMPD(webm.url).then(function (url) {
                    webm.url = url;
                    return webm;
                });
            }
            else
                return webm;
        });
    }

    getStreamFromMPD(url) {
        return $.ajax(url).then(function (mpd) {
            var xml = $.parseXML(mpd),
                m = xml.find('AdaptationSet[mimeType="audio/webm"] BaseURL');
            if (m.length == 0) m = xml.find('BaseURL');
            if (m.length == 0)
                throw new Error(`no stream found in MPD '${url}'`);
            
            return m.first().text();
        });
    }

    playlists() { return Promise.resolve([]);  /** @todo */ }
}

class YoutubeItem {
    static id(item) {
        var id = item.id || item.snippet && item.snippet.resourceId;
        return id.videoId || id;
    }
    static kind(item) {
        var id = item.id || item.snippet && item.snippet.resourceId;
        return (id && id.kind) || item.kind  /** makes you wish you had `?.` */
    }
    static title(item) {
        return item.snippet && item.snippet.title;
    }
    static url(item) {
        return `https://youtube.com/watch?v=${YoutubeItem.id(item)}`;
    }
}


class YtdlPlayerInPageCore extends YtdlPlayerCore {
    enqueue(tracks) {
        if (!Array.isArray(tracks)) tracks = [tracks];
        tracks.forEach(function(track) {
            app.$refs.playlist.playlist.add(track);
        });
    }
}


var playerCore, yapi;

if (typeof mainActivity !== 'undefined') {       /* In Android WebView */
    playerCore = new YtdlPlayerCore();
    yapi = new YouTubeSearch();
}
else if (typeof process !== 'undefined' &&       /* In NWjs standalone app */
        !(location.search && location.search.length)) {
    playerCore = new YtdlPlayerInPageCore([/^audio[/]webm; codecs="opus"/]);
    yapi = new YouTubeSearch();
}
else {                                           /* In client browser */
    playerCore = new ClientPlayerCore();
    yapi = new ClientYouTubeSearch();
}


function playInPage(track, mediaUrl, mediaType) {
    var a = $('<audio>').attr('controls', true);
    a.data('track', track);
    a.append($('<source>').attr('src', mediaUrl));
    $('#video-area').html(a);
}


function action(cmd) {
    switch (cmd.type) {
    case 'watch':    return playerCore.watch(cmd.url);
    case 'search':   return app.search(cmd.text);
    case 'details':  return yapi.details(cmd.videoId);
    case 'playlist': app.openPlaylist(cmd.data); return Promise.resolve();
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
    console.log("message: " + JSON.stringify(msg), msg.data);
    if (typeof msg.data === 'string')
        action(JSON.parse(msg.data));
};
