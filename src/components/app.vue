<template>
    <div id="ui-container" :class="status" @dragover="dragOver" @drop="drop">
        <volume-control ref="volume" v-model="state.volume"/>
        <!-- <control-panel ref="controls" :show="show"/> -->
        <search-pane ref="searchPane" @selected="startTrack" :state="state.search" :spotlight="spotlight"/>
        <playlist-pane v-if="playlist && show.playlist"
                       ref="playlistPane" v-model:playlist="playlist" :show="show"
                       @selected="startTrack" :spotlight="spotlight" :uploadedTrackIds="uploadedTrackIds"/>
    </div>
</template>

<script lang="ts">
import { Vue, Component, Prop, Ref, toNative } from 'vue-facing-decorator';
import SearchPane from './search-pane.vue';
import PlaylistPane from './playlist-pane.vue';
import VolumeControl from './controls/volume-slider.vue';

import { AppState } from '../model';
import { Playlist } from '../playlist';
import { YoutubeItem } from '../player';
import { DroppedFiles } from '../files';

@Component({
    components: {
        SearchPane,
        PlaylistPane,
        VolumeControl
    }
})
class IApp extends Vue {
    @Prop state: AppState

    status = 'ready'
    curPlaying = undefined
    playlist = Playlist.restore()
    playlists = []
    uploadedTrackIds = []
    ongoing = {upload: undefined, download: undefined}
    show = {playlist: true, playlists: false}
    init = false

    @Ref searchPane: any
    @Ref playlistPane: any
    @Ref menu: any

    mounted() {
    }

    get hasContextMenu() { return true; } // typeof AppContextMenu != 'undefined'; }

    get focused() { return undefined; } //{ var v = this.init && this.$refs.menu; return v && v.for && YoutubeItem.id(v.for.item); }
    get spotlight() { return {active: this.curPlaying, focused: this.focused}; }

    search(query, opts) {
        return this.searchPane.search(query, opts);
    }

    startTrack(item, opts) {
        var self = this, operation;
        this.status = 'pending';
        this.curPlaying = YoutubeItem.id(item);

        operation = playerCore.watch(item.uri || this.curPlaying, opts);
        operation.then(function() { self.status = 'playing'; })
                 .catch(function() { self.status = 'error'; });
    }

    /** UPLOAD PART **/

    upload(file, name) {
        var hasFS = (typeof process !== 'undefined' &&
                        !!(process.versions && process.versions.nw));   // NWjs
        if (file.type == 'application/json') {
            this.playlistPane.openPlaylist(file);
        }
        else if (file.type.match(/^(audio|video)[/]/) ||
                    file.name.match(/[.](mkv)$/)) {
            if (hasFS) {
                return Promise.resolve([Playlist.trackFromFile(file)]);
            }
            else {
                return playerCore.upload.file(file, 
                    this._monitorProgress('upload', {filename: file.name}),
                    name).then(x => [x]);
            }
        }
        else console.warn("unrecognized file type: " + file.type);
        return Promise.resolve([]);
    }

    uploadMultiple(files) {
        var conts = [], _this = this;
        for (var i = 0; i < files.length; i++) {
            conts.push((function(f, id) {
                return function() {
                    return _this.upload(f, id).then(function(tracks) {
                        console.log('enqueue', tracks);
                        playerCore.enqueue(tracks);
                    });
                }
            })(files[i], 'c'+i));
        }
        waterfall(conts);
    }

    droppedFiles(dt) {
        var _this = this;
        DroppedFiles.fromDataTransfer(dt).then(function(files) {
            _this.uploadMultiple(files);
        });
    }

    dragOver(ev) { ev.preventDefault(); }
    drop(ev) {
        ev.preventDefault();
        if (ev.dataTransfer.files.length > 0)
            this.droppedFiles(ev.dataTransfer);
        else if (this.playlistPane)
            this.playlistPane.dropAway(ev);
    }

    _monitorProgress(prop /* 'upload'|'download' */, obj: {filename?: string, progress?: number} = {}) {
        var o = this.ongoing;
        obj.filename = obj.filename; // huh
        obj.progress = undefined;
        o[prop] = obj;
        return function(p, fn) {
            if (fn) obj.filename = fn;
            if (p) obj.progress = p; else o[prop] = undefined;
        };
    }
}


function waterfall(conts) {
    return conts.reduce(function(p, cont) {
        return p.then(cont);
    }, Promise.resolve());
}


export { IApp }
export default toNative(IApp)
</script>