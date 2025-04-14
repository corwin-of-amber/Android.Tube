<template>
    <div id="ui-container" :class="status" @dragover="dragOver" @drop="drop"
            @contextmenu="openContextMenu">
        <volume-control ref="volume" v-model="state.volume"/>
        <control-panel ref="controls" :state="state" :show="show"/>
        <search-pane ref="searchPane" @selected="startTrack" :state="state.search" :spotlight="spotlight"/>
        <playlist-pane v-if="playlist && show.playlist"
                       ref="playlistPane" v-model:playlist="playlist" :show="show"
                       @selected="startTrack" :spotlight="spotlight" :uploadedTrackIds="uploadedTrackIds"/>
    </div>
    <app-context-menu ref="menu" @action="menuAction"/>
</template>

<script lang="ts">
import { Vue, Component, Prop, Ref, toNative } from 'vue-facing-decorator';
import SearchPane from './search-pane.vue';
import PlaylistPane from './playlist-pane.vue';
import VolumeControl from './controls/volume-slider.vue';
import ControlPanel from './controls/control-panel.vue';

import AppContextMenu, { IAppContextMenu }  from './app-context-menu.vue';

import { AppState, Track } from '../model';
import { Playlist } from '../playlist';
import { YoutubeItem } from '../player';
import { DroppedFiles } from '../files';
import { ClientPlayerCore } from '../client';


@Component({
    components: {
        SearchPane,
        PlaylistPane,
        VolumeControl,
        ControlPanel,
        AppContextMenu
    }
})
class IApp extends Vue {
    @Prop state: AppState

    status = 'ready'
    curPlaying: Track = undefined
    playlist = Playlist.restore()
    playlists = []
    uploadedTrackIds = []
    ongoing = {upload: undefined, download: undefined}
    show = {playlist: true, playlists: false}
    init = false

    menufor: any

    client: ClientPlayerCore

    @Ref searchPane: any
    @Ref playlistPane: any
    @Ref menu: IAppContextMenu

    mounted() { this.init = true; }

    get focused() { 
        if (this.init) {
            let v = this.menu?.for?.item;
            //return v && YoutubeItem.id(v);
            return v;
        }
    }
        //var v = this.init && this.$refs.menu; return v && v.for && YoutubeItem.id(v.for.item); }
    get spotlight() {
        return {
            active: this.curPlaying && YoutubeItem.id(this.curPlaying),
            focused: this.focused
        };
    }

    search(query, opts) {
        return this.searchPane.search(query, opts);
    }

    startTrack(item, opts) {
        var self = this, operation;
        this.status = 'pending';
        this.curPlaying = item;

        if (this.playlist?.has(item)) {
            operation = playerCore.watchFromList(
                this.playlist.export(item),
                {...(opts || {}), onend: () => this.playNext()});
        }
        else {
            operation = playerCore.watch(item.uri || YoutubeItem.id(this.curPlaying), opts);
        }
        operation.then(function() { self.status = 'playing'; })
                 .catch(function(e) { console.error(e); self.status = 'error'; });
    }

    playNext() {
        let curIndex = this.playlist.indexOf(this.curPlaying as Playlist.Track);
        if (curIndex >= 0 && curIndex < this.playlist.tracks.length - 1) {
            this.startTrack(this.playlist.tracks[curIndex + 1], {autoplay: true});
        }
    }

    openPlaylist(props: object) {
        this.playlistPane.openPlaylist(props);
        this.show.playlist = true;
    }

    /** UPLOAD PART **/

    connect() {
        this.client = new ClientPlayerCore();
        this.client.upload.remoteKeys = this.uploadedTrackIds;
    }

    async upload(file, name) {
        var hasFS = (typeof process !== 'undefined' &&
                        !!(process.versions && process.versions.nw));   // NWjs
        if (file.type == 'application/json') {
            this.playlistPane.openPlaylist(file);
        }
        else if (file.type.match(/^(audio|video)[/]/) ||
                    file.name.match(/[.](mkv)$/)) {
            if (hasFS) {
                return await Track.fromFileEx(file);
            }
            else {
                return [playerCore.upload.file(file, 
                    this._monitorProgress('upload', {filename: file.name}),
                    name)];
            }
        }
        else console.warn("unrecognized file type: " + file.type);
        return [];
    }

    async uploadMultiple(files: any[]) {
        for (var i = 0; i < files.length; i++) {
            let tracks = await this.upload(files[i], `c${i}`);
            console.log('enqueue', tracks);
            playerCore.enqueue(tracks);
        }
    }

    droppedFiles(dt: DataTransfer) {
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

    openContextMenu(ev) {
        this.menu.open(ev);
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

    /** MENU PART **/

    menuAction(action) {
        console.log('menuAction', action)
        if (action.for) action.for.action(action); /** @oops oh my */
        switch (action.type) {
        case 'playlist-new':
            this.playlistPane.newPlaylist();
            break;
        case 'set-global':
            console.log('temp1', (<any>window).temp1 = action.for.item);
            break;
        case 'download':
            throw new Error('not implemented');
            /*
            AudioDownload.do(action.for.item, {},
                this._monitorProgress('download'));*/
            break;
        case 'connect':
            this.connect();
            break;
        case 'play-remote':
            this.remotePlay(action.for.item, false, false, 'play');
            break;
        case 'play-remote-all':
            this.remotePlay(action.for.item, true, false, 'play');
            break;
        case 'upload':
            this.remotePlay(action.for.item, false, true /* force upload */);
            break;
        case 'upload-all':
            this.remotePlay(action.for.item, true, true /* force upload */);
            break;
        }
    }

    remotePlay(item: Track, all, force, play?) {
        if (!this.client) this.connect();
        if (item) {
            var [idx, tracks] = all ? this.itemToEnd(item)
                                    : this.itemIdx(item);
            this.client.upload.tracks(tracks,
                this._monitorProgress('upload'), Math.max(idx, 0),
                force, play);
        }
    }

    itemIdx(item: Track): [number, Track[]] {
        var idx = this.playlist ? this.playlist.indexOf(item) : 0;
        return [idx, [item]];
    }
    itemToEnd(item: Track): [number, Track[]] {
        if (Playlist.isTrack(item) && this.playlist) {
            var idx = this.playlist.indexOf(item);
            return idx >= 0 ? [idx, this.playlist.tracks.slice(idx)]
                            : [0, [item]];
        }
        else return [0, [item]]
    }    

}


export { IApp }
export default toNative(IApp)
</script>