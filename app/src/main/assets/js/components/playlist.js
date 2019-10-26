

Vue.component('playlist-ui', {
    props: ['playlist', 'active'],
    data: () => ({ dragState: undefined }),
    template:
    `
    <div class="playlist-ui" @dragover="dragOver" @dragleave="dragOut"
                @drop="drop" :class="{['drag-'+dragState]: !!dragState}">
        <h1 contenteditable="true">{{playlist.name}}</h1>
        <template v-for="item in playlist.items">
            <div class="playlist-item">
                <div class="gutter"/>
                <video-snippet
                    :item="item" :active="item.id.videoId === active"
                    @click="$emit('selected', item)"/>
            </div>
        </template>
    </div>
    `,

    mounted() {
        this.$watch('playlist', (playlist) => {
            if (!playlist.items) this.$set(playlist, 'items', []);
            if (!playlist.id)    this.$set(playlist, 'id', Playlist.mkShortId());
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

    constructor(name, items=[]) {
        this.name = name;
        this.items = items;
    }

    add(item) {
        var injectProps = {_playlist: this.id,
                           _playlistItem: Playlist.mkShortId()}
        this.items.push(Object.assign({}, item, injectProps));
    }

    remove(item) {
        var id = JSON.stringify(item.id),
            index = this.items.findIndex(e => JSON.stringify(e.id) === id);
        if (index >= 0) {
            this.items.splice(index, 1);
            return true;
        }
        else return false;
    }

    store(key) { Playlist.store(this, key); }

    static store(data, key='tube.playlist') {
        localStorage[key] = JSON.stringify(data);
    }

    static restore(key='tube.playlist') {
        var stored = localStorage[key],
            pl = Object.assign(new Playlist, stored ? JSON.parse(stored) : {});
        for (let item of pl.items) {
            if (!item._playlist)     item._playlist = this.id;
            if (!item._playlistItem) item._playlistItem = Playlist.mkShortId();
        }
        return pl;
    }

    static mkShortId() {
        return Math.random().toString(36).slice(2);
    }
}