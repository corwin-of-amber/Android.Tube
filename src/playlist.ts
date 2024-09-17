import $ from 'jquery';
import { YoutubeItem } from './player';


class Playlist {

    id: string
    name: string
    tracks: any[]

    constructor(name, tracks) {
        this.name = name;
        this.tracks = tracks || [];
        this.id = Playlist.mkShortId();
    }

    add(item) {
        item = Object.assign({}, item, {_playlist: this.id,
                                        _playlistItem: Playlist.mkShortId()});
        if (!item.id) item.id = Playlist.mkShortId();
        this.tracks.push(item);
        return item;
    }

    remove(item) {
        var index = this.indexOf(item);
        if (index >= 0) {
            this.tracks.splice(index, 1);
            return true;
        }
        else return false;
    }

    move(item, relativeTo, bearing="above") {
        var fromIndex = this.tracks.indexOf(item);
        if (fromIndex < 0) throw new Error('Playlist.move: source item not found');
        var toIndex = this.tracks.indexOf(relativeTo);
        if (toIndex < 0) throw new Error('Playlist.move: target item not found');
        if (bearing == "below") toIndex++;
        if (fromIndex !== toIndex) {
            this.tracks.splice(fromIndex, 1);
            if (toIndex > fromIndex) toIndex--; /* slightly evil */
            this.tracks.splice(toIndex, 0, item);
        }
    }

    addFile(file) {
        return this.add(Playlist.trackFromFile(file));
    }

    indexOf(item) {
        var id = JSON.stringify(item.id),
            itemId = item._playlistItem;
        return itemId
                ? this.tracks.findIndex(function(e) { return e._playlistItem === itemId; })
                : this.tracks.findIndex(function(e) { return JSON.stringify(e.id) === id; });
    }

    find(item) {
        return this.tracks[this.indexOf(item)];
    }

    static from(props) {
        if (typeof props === 'string') props = JSON.parse(props);
        var pl = Object.assign(new Playlist(null, null), props || {});
        if (!pl.id && pl.tracks.length > 0)
            pl.id = Playlist.mkShortId();
        for (let track of pl.tracks) {
            if (!track._playlist)     track._playlist = pl.id;
            if (!track._playlistItem) track._playlistItem = Playlist.mkShortId();
        }
        return pl;
    }

    static open(data) {
        return (data instanceof Blob) ? Playlist.upload(data) : 
            Promise.resolve((data instanceof Playlist) ? data :
                Playlist.from(data));
    }

    store(key) {
        Playlist.store(this, key);
        if (!key && this.id) {
            // Also store by id
            Playlist.store(this, Playlist.DEFAULT_STORAGE_KEY + '-' + this.id);
        }
    }

    static store(data: Playlist, key: string) {
        key = key || Playlist.DEFAULT_STORAGE_KEY;
        localStorage[key] = JSON.stringify(data);
    }

    static restore(key?: string) {
        key = key || Playlist.DEFAULT_STORAGE_KEY;
        return Playlist.from(localStorage && localStorage[key]);
    }

    static loadFromServer(id) {
        // @ts-ignore
        return server_action(`playlists/${id}`).then(Playlist.from);
    }

    download(filename: string) {
        if (!filename) filename = `${this.name || 'playlist'}.json`;
        var blob = new Blob([JSON.stringify(this)]);
        $('<a>').attr({href: URL.createObjectURL(blob), download: filename})
            [0].click();
    }

    static upload(blob: Blob) {
        return blob.text().then(function(text) {
            return Playlist.from(text);
        });
    }

    static trackFromFile(file: string | {name: string, path: string}) {
        if (typeof file === 'string')
            file = {name: file.match(/[^/]*$/)?.[0] || '???', path: file};
        // @todo use URL.createObjectURL for blobs with no file:// access
        return {id: sillyHash(file.path), kind: Playlist.KIND.LOCAL, 
            snippet: {title: file.name}, uri: 'file://' + file.path};
    }

    /**
     * Imports a youtube#playlistItemListResponse into this playlist
     * @param {items} object either a response from a playlistItems query
     *   to the Youtube API, or the `items` member of such.
     */
    importYoutube(items) {
        if (items.items) items = items.items;
        for (var i = 0; i < items.length; i++) {
            var item = items[i];
            this.add({
                id: item.snippet.resourceId.videoId,
                snippet: item.snippet
            });
        }
        return this;
    }

    /**
     * Creates a playlist JSON that is suitable for sending to the server.
     */
    export(nowPlaying) {
        if (typeof nowPlaying !== 'number')
            nowPlaying = this.indexOf(nowPlaying);

        const mkTrack = function(track) {
            var id = YoutubeItem.id(track),
                kind = /^youtube#/.exec(YoutubeItem.kind(track)) ?
                        Playlist.KIND.YOUTUBE : Playlist.KIND.DIRECT;
            return {
                id: id, kind: kind,
                uri: track.uri || id
            };
        };

        return {tracks: this.tracks.map(mkTrack), nowPlaying};
    }

    static mkShortId() {
        return Math.random().toString(36).slice(2);
    }


    static KIND = {DIRECT: 1, YOUTUBE: 2, LOCAL: 3};
    static DEFAULT_STORAGE_KEY = 'tube.playlist';
}


function sillyHash(string) {
    return string.split('').reduce((hash, char) => {
        return char.charCodeAt(0) + (hash << 6) + (hash << 16) - hash;
    }, 0).toString(36);
}


export { Playlist }