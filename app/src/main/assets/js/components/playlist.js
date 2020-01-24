'use strict';


Vue.component('playlist-ui', {
    props: ['playlist', 'active'],
    data: function() { return { dragState: undefined }; },
    template:
    `
    <div class="playlist-ui" @dragover="dragOver" @dragleave="dragOut"
                @drop="drop" :class="{['drag-'+dragState]: !!dragState}">
        <h1 contenteditable="true">{{playlist.name}}</h1>
        <div>
            <div class="playlist-item" v-for="track in playlist.tracks">
                <div class="gutter"/>
                <video-snippet
                    :item="track" :active="track.id.videoId === active"
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
        dragOver(ev) {
            var item = ev.dataTransfer.getData("json");
            if (item) {
                item = JSON.parse(item);
                if (item.id && item._playlist != this.playlist.id) {
                    this.dragState = 'over';
                    ev.preventDefault();
                    ev.stopPropagation();
                }    
            }
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

        store() { Playlist.store(this.playlist) }
    }
});


class Playlist {

    constructor(name, tracks) {
        this.name = name;
        this.tracks = tracks || [];
    }

    add(item) {
        var injectProps = {_playlist: this.id,
                           _playlistItem: Playlist.mkShortId()}
        this.tracks.push(Object.assign({}, item, injectProps));
    }

    remove(item) {
        var index = this.indexOf(item);
        if (index >= 0) {
            this.tracks.splice(index, 1);
            return true;
        }
        else return false;
    }

    indexOf(item) {
        var id = JSON.stringify(item.id),
            itemId = item._playlistItem;
        return itemId
                ? this.tracks.findIndex(function(e) { return e._playlistItem === itemId; })
                : this.tracks.findIndex(function(e) { return JSON.stringify(e.id) === id; });
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

    store(key) { Playlist.store(this, key); }

    static store(data, key) {
        key = key || Playlist.DEFAULT_STORAGE_KEY;
        localStorage[key] = JSON.stringify(data);
    }

    static restore(key) {
        key = key || Playlist.DEFAULT_STORAGE_KEY;
        return Playlist.from(localStorage && localStorage[key]);
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

    /**
     * Creates a playlist JSON that is suitable for sending to the server.
     */
    export(nowPlaying) {
        if (typeof nowPlaying !== 'number')
            nowPlaying = this.indexOf(nowPlaying);

        const mkTrack = function(track) {
            return {
                id: track.id.videoId, kind: Playlist.KIND.YOUTUBE,
                uri: track.id.videoId
            };
        };

        return {tracks: this.tracks.map(mkTrack), nowPlaying};
    }

    static mkShortId() {
        return Math.random().toString(36).slice(2);
    }

}


Playlist.KIND = {YOUTUBE: 2};
Playlist.DEFAULT_STORAGE_KEY = 'tube.playlist';
