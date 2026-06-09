<template>
    <div class="playlist-ui" @dragover="dragOver" @dragleave="dragOut"
                @drop="drop" :class="{['drag-'+dragState]: !!dragState}">
        <!-- <playlist-toolbox :show="show"/> -->
        <playlist-caption v-model:value="playlist.name"/>
        <div class="list playlist-body">
            <div v-for="(track,$idx) in playlist.tracks"
                 class="playlist-item" 
                 :class="{['drag-'+dragEdge]: !!dragState && dragItem === track,
                           uploaded: (uploadedTrackIds || []).includes(track.id)}"
                 @dragover="dragOverItem(track, $event)" @dragleave="dragLeaveItem"
                 @drop="dropItem(track, $event)">
                <div class="gutter"></div>
                <track-snippet
                    :item="track" :spotlight="spotlightOf(track)"
                    @click="$emit('selected', track)"/>
            </div>
        </div>
    </div>
</template>

<script lang="ts">
import PlaylistCaption from './playlist-caption.vue'
import TrackSnippet from './track-snippet.vue';
import { Track } from '../model';
import { Playlist } from '../playlist';
import { YoutubeItem } from '../player';
import { YouTubeSearch } from '../search/yapi';

declare var yapi: YouTubeSearch;


export default {
    props: ['playlist', 'spotlight', 'show', 'uploadedTrackIds'],
    data: function() { return { dragState: undefined, dragItem: undefined, dragEdge: undefined }; },

    mounted() {
        this.$watch('playlist', () => this.store(), {deep: true});
    },
    methods: {
        newPlaylist() {
            this.$emit('update:playlist', new Playlist('-'));
        },
        async openPlaylist(playlistData) {
            let playlist = await Playlist.open(playlistData);
            this.$emit('update:playlist', playlist);
            return playlist;
        },
        async loadPlaylist(id) {
            let playlist = await Playlist.loadFromServer(id);
            this.$emit('update:playlist', playlist);
            return playlist;
        },
        async importPlaylist(youtubePlaylistId) {
            let items = await yapi.playlistItemsAll(youtubePlaylistId),
                playlist = new Playlist('Imported').importYoutube(items);
            this.$emit('update:playlist', playlist);
            return playlist;
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
                self.$emit('update:playlist', pl);
            });
        },
        async loadTrackInfo() {
            let playlist = this.playlist as Playlist;
            for (let i in playlist.tracks) {
                let t = playlist.tracks[i];
                if (t.contentDetails && !t.duration) {
                    t.duration = YoutubeItem.parseTimeStamp(t.contentDetails.duration);
                }
                if (!t.snippet || !t.contentDetails) {
                    playlist.tracks[i] = await yapi.info(YoutubeItem.id(t)) as Playlist.Track;
                }
            }
        },

        spotlightOf(track: Track) { /** @oops duplicated from <search-pane> */
            let id = YoutubeItem.id(track);
            return id ? {active:  id === this.spotlight.active,
                         focused: track === this.spotlight.focused} : {};
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

        store() { Playlist.store(this.playlist) }
    },

    components: { TrackSnippet, PlaylistCaption }
}
</script>