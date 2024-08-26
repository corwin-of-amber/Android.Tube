import $ from 'jquery';
import * as ytdl from '@distube/ytdl-core';


declare var mainActivity: any;

var DEFAULT_MEDIA_TYPE = '';  //  can be 'audio/' or 'video/'
var PREFERRED_FORMATS = [     //  most preferred first
    /^audio[/]mp4; codecs="mp4a.*"/,
    /^audio[/]webm; codecs="opus"/
];


class YtdlPlayerCore {
    preferredFormats: RegExp[]

    constructor(preferredFormats?) {
        this.preferredFormats = (preferredFormats || PREFERRED_FORMATS);
    }

    watch(urlOrId, opts) {
        var self = this;
        return this.getWatchUrl(urlOrId).then(
            function(webm) { self.playStream(urlOrId, webm, opts); })
            .catch(function(err) { console.error(err); });
    }

    watchFromList(playlistData, opts) {
        if (typeof mainActivity === 'undefined')
            return this.watch(playlistData.tracks[playlistData.nowPlaying || 0].uri, // sorry
                              opts);
        else {
            mainActivity.playFromList(JSON.stringify(playlistData));
            return Promise.resolve();
        }
    }

    getWatchUrl(urlOrId, type?, preferredFormats?) {
        if (ytdl.validateID(urlOrId) || ytdl.validateURL(urlOrId))
            return this.getStream(urlOrId, type, preferredFormats);
        else return Promise.resolve({url: urlOrId, type: 'unknown'});
    }

    playStream(urlOrId, webm, opts) {
        mainActivity.receivedUrl(urlOrId, webm.type, webm.url);
    }

    getStream(youtubeUrl, type?, preferredFormats?) {
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
                console.log(`format #${++i}/${n}: ${format.itag} ${ftype}\n` +
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


class YtdlPlayerInPageCore extends YtdlPlayerCore {
    container: HTMLElement
    current: {
        track: any
        audio: HTMLAudioElement
    }

    constructor(preferredFormats?) {
        super(preferredFormats);
        this.container = document.querySelector('#video-area');
    }

    playStream(urlOrId, webm, opts) {
        var a = $('<audio>').attr({controls: true, autoplay: opts && opts.autoplay});
        a.append($('<source>').attr('src', webm.url));
        if (opts && opts.onend) a.on('ended', opts.onend);
        this.current = {track: webm, audio: a};
        this._put(a[0]);
    }

    enqueue(tracks) {
        if (!Array.isArray(tracks)) tracks = [tracks];
        tracks.forEach(function(track) {
            // @ts-ignore
            app.$refs.playlist.playlist.add(track);
        });
    }

    _put(el: HTMLElement) {
        let c = this.container, e: ChildNode;
        while (e = c.firstChild) c.removeChild(e);
        c.append(el);
    }
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
    static mediaUriOrId(item) {
        return item.uri || YoutubeItem.id(item);
    }
    static webUrl(item) {
        return item.uri || `https://youtube.com/watch?v=${YoutubeItem.id(item)}`;
    }
}


export { YtdlPlayerCore, YtdlPlayerInPageCore, YoutubeItem }