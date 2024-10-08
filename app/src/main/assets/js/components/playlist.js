'use strict';


Vue.component('playlist-ui', {
    props: ['playlist', 'spotlight', 'show', 'uploadedTrackIds'],
    model: {prop: 'playlist', event: 'change'},
    data: function() { return { dragState: undefined, dragItem: undefined, dragEdge: undefined }; },
    template: `
    <div class="playlist-ui" @dragover="dragOver" @dragleave="dragOut"
                @drop="drop" :class="{['drag-'+dragState]: !!dragState}">
        <playlist-toolbox :show="show"/>
        <playlist-caption v-model="playlist.name"/>
        <div class="list playlist-body">
            <div v-for="(track,$idx) in playlist.tracks"
                 class="playlist-item" 
                 :class="{['drag-'+dragEdge]: !!dragState && dragItem === track,
                           uploaded: (uploadedTrackIds || []).includes(track.id)}"
                 @dragover="dragOverItem(track, $event)" @dragleave="dragLeaveItem"
                 @drop="dropItem(track, $event)">
                <div class="gutter"/>
                <video-snippet
                    :item="track" :spotlight="spotlightOf(itemId(track))"
                    @click="$emit('selected', track)"/>
            </div>
        </div>
    </div>
    `,

    mounted() {
        var self = this;
        this.$watch('playlist', function(playlist) {
            if (!playlist.tracks) self.$set(playlist, 'tracks', []);
            if (!playlist.id)     self.$set(playlist, 'id', Playlist.mkShortId());
        }, {immediate: true});
        this.$watch('playlist', function() { self.store(); }, {deep: true});
    },
    methods: {
        newPlaylist() {
            this.$emit('change', new Playlist());
        },
        openPlaylist(playlist) {
            var self = this;
            return Playlist.open(playlist).then(function(playlist) {
                self.$emit('change', playlist); return playlist;
            });
        },
        loadPlaylist(id) {
            var self = this;
            return Playlist.loadFromServer(id).then(function(playlist) {
                self.$emit('change', playlist); return playlist;
            });
        },
        importPlaylist(youtubePlaylistId) {
            var self = this;
            yapi.playlistItemsAll(youtubePlaylistId).then(function(items) {
                self.$emit('change', new Playlist('Imported').importYoutube(items));
            });
        },
        importTracks(youtubeItem) {
            var self = this,
                ts = typeof youtubeItem == 'string' ?
                    TrackSplit.fromYouTubeId(youtubeItem) :  /* ui/tracks.ts */
                    TrackSplit.fromTrack(youtubeItem);

            ts.then(function(ts) { return ts.fetchTracks(); })
            .then(function(tracks) {
                var pl = new Playlist(YoutubeItem.title(youtubeItem) || 'Imported Tracks');
                pl.tracks = tracks;
                self.$emit('change', pl);
            });
        },

        spotlightOf(id) { /** @oops duplicated from <search-ui> */
            return id ? {active:  id === this.spotlight.active,
                         focused: id === this.spotlight.focused} : {};
        },

        dragOver(ev) {
            /** @todo ignore files when in client mode? */
            this.dragState = 'over';
            ev.preventDefault(); ev.stopPropagation();
        },
        dragOut(ev) { this.dragState = undefined; },
        drop(ev) {
            var item = ev.dataTransfer.getData("json");
            if (item) {
                item = JSON.parse(item);
                if (item.id) {
                    if (item._playlist != this.playlist.id)
                        this.playlist.add(item);
                    ev.stopPropagation();
                }
            }
            this.dragState = undefined;
        },
        dropAway(ev) {  /* called by the UI container when item is dropped outside */
            if (this.playlist && this.playlist.id) {
                var item = ev.dataTransfer.getData("json");
                if (item) {
                    item = JSON.parse(item);
                    if (item.id && item._playlist == this.playlist.id
                            && this.playlist.remove(item)) {
                        ev.stopPropagation();
                    }
                }
            }
        },

        dragOverItem(track, ev) {
            this.dragItem = track; //ev.currentTarget.getAttribute('data-idx');
            var bbox = ev.currentTarget.getBoundingClientRect(), y = ev.clientY;
            this.dragEdge = y - bbox.top > bbox.height / 2 ? 'below' : 'above';
        },
        dragLeaveItem(ev) { ev.stopPropagation(); },
        dropItem(track, ev) {
            var item = ev.dataTransfer.getData("json");
            if (item) {
                item = JSON.parse(item);
                if (item._playlist === this.playlist.id) {
                    var from = this.playlist.find(item);
                    if (from) {
                        this.playlist.move(from, track, this.dragEdge);
                    }
                }
            }
        },

        itemId(item) { return YoutubeItem.id(item); },

        store() { Playlist.store(this.playlist) }
    }
});

Vue.component('playlist-caption', {
    props: ['value'],
    template: `
        <h1 contenteditable="true"
            @keydown="keydown" @blur="commit">{{value}}</h1>
    `,
    methods: {
        keydown(ev) {
            switch (ev.key) {
            case 'Enter':
                ev.preventDefault();
                this.commit();  break;
            case 'Escape':
                ev.preventDefault();
                this.rollback();  break;
            }
        },
        commit() {
            this.$emit('input', this.$el.textContent);
            this.$el.blur();
        },
        rollback() {
            this.$el.textContent = this.value;
            this.$el.blur();
        }
    }
});

Vue.component('playlist-toolbox', {
    props: ['show'],
    template: `
        <div class='toolbox'>
            <button name='index' @click="toggleIndex">@</button>
        </div>
    `,
    methods: {
        toggleIndex() {
            this.show.playlists = !this.show.playlists;
        }
    }
});

Vue.component('playlist-ui-index', {
    props: ['playlists', 'active'],
    data: function() { return { dragState: undefined }; },
    template: `
    <div class="playlist-ui-index">
        <h1>Playlists</h1>
        <ul class="list">
            <li class="playlist-entry" :class="{active: entry.id == active}"
                    v-for="entry in playlists"
                    @click="$emit('selected', entry)">
                <span>{{entry.name}}</span>
            </li>
        </ul>
    </div>
    `,
});


class Playlist {

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
        var pl = Object.assign(new Playlist, props || {});
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

    static store(data, key) {
        key = key || Playlist.DEFAULT_STORAGE_KEY;
        localStorage[key] = JSON.stringify(data);
    }

    static restore(key) {
        key = key || Playlist.DEFAULT_STORAGE_KEY;
        return Playlist.from(localStorage && localStorage[key]);
    }

    static loadFromServer(id) {
        return server_action(`playlists/${id}`).then(Playlist.from);
    }

    download(filename) {
        if (!filename) filename = `${this.name || 'playlist'}.json`;
        var blob = new Blob([JSON.stringify(this)]);
        $('<a>').attr({href: URL.createObjectURL(blob), download: filename})
            [0].click();
    }

    static upload(blob) {
        return blob.text().then(function(text) {
            return Playlist.from(text);
        });
    }

    static trackFromFile(file) {
        if (typeof file === 'string')
            file = {name: file.match(/[^/]*$/)[0] || '???', path: file};
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

}


Playlist.KIND = {DIRECT: 1, YOUTUBE: 2, LOCAL: 3};
Playlist.DEFAULT_STORAGE_KEY = 'tube.playlist';


function sillyHash(string) {
    return string.split('').reduce((hash, char) => {
        return char.charCodeAt(0) + (hash << 6) + (hash << 16) - hash;
    }, 0).toString(36);
}