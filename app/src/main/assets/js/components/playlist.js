

Vue.component('playlist-ui', {
    props: ['playlist', 'active'],
    data: () => ({ dragState: undefined }),
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
        this.$watch('playlist', (playlist) => {
            if (!playlist.tracks) this.$set(playlist, 'tracks', []);
            if (!playlist.id)     this.$set(playlist, 'id', Playlist.mkShortId());
        }, {immediate: true});
        this.$watch('playlist', () => this.store(), {deep: true});
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

    constructor(name, tracks=[]) {
        this.name = name;
        this.tracks = tracks;
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
                ? this.tracks.findIndex(e => e._playlistItem === itemId)
                : this.tracks.findIndex(e => JSON.stringify(e.id) === id);
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

    static store(data, key='tube.playlist') {
        localStorage[key] = JSON.stringify(data);
    }

    static restore(key='tube.playlist') {
        return Playlist.from(localStorage[key]);
    }

    download(filename) {
        if (!filename) filename = `${this.name || 'playlist'}.json`;
        var blob = new Blob([JSON.stringify(this)]);
        $('<a>').attr({href: URL.createObjectURL(blob), download: filename})
            [0].click();
    }

    static async upload(blob) {
        return Playlist.from(await blob.text());
    }

    /**
     * Creates a playlist JSON that is suitable for sending to the server.
     */
    export(nowPlaying) {
        if (typeof nowPlaying !== 'number')
            nowPlaying = this.indexOf(nowPlaying);

        const mkTrack = track => ({
            id: track.id.videoId, kind: Playlist.KIND.YOUTUBE,
            uri: track.id.videoId});

        return {tracks: this.tracks.map(mkTrack), nowPlaying};
    }

    static mkShortId() {
        return Math.random().toString(36).slice(2);
    }

    static KIND = {YOUTUBE: 2};
}