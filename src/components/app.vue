<template>
    <div id="ui-container" :class="status" @dragover="dragOver" @drop="drop"
            @contextmenu="openContextMenu">
        <volume-control ref="volume" v-model="state.volume"/>
        <control-panel ref="controlPanel" :state="state" :show="show"/>
        <search-pane ref="searchPane" @selected="startTrack" :state="state.search" :spotlight="spotlight"/>
        <playlist-pane v-if="playlist && show.playlist"
                       ref="playlistPane" v-model:playlist="playlist" :show="show"
                       @selected="startTrack" :spotlight="spotlight" :uploadedTrackIds="uploadedTrackIds"/>

        <!-- @oops using span to enable using CSS ':last-of-type' on divs above :/ -->
        <span>
            <progress-bar class="download-progress" v-bind="ongoing.download" v-if="ongoing.download"/>
            <progress-bar class="upload-progress" v-bind="ongoing.upload" v-if="ongoing.upload"/>
        </span>
    </div>
    <app-context-menu ref="menu" :clientConnected="!!client" @action="menuAction"/>
</template>

<script lang="ts">
import { toRaw } from 'vue';
import { Vue, Component, Prop, Ref, Watch, toNative } from 'vue-facing-decorator';
import SearchPane from './search-pane.vue';
import PlaylistPane from './playlist-pane.vue';
import VolumeControl from './controls/volume-slider.vue';
import ControlPanel, { IControlPanel } from './controls/control-panel.vue';
import ProgressBar from './controls/progress-bar.vue';

import AppContextMenu, { IAppContextMenu }  from './app-context-menu.vue';

import { AppState, Track } from '../model';
import { Playlist } from '../playlist';
import { YoutubeItem } from '../player';
import { PlayerControls } from '../controls';
import { DroppedFiles } from '../files';
import { ClientPlayerControls, ClientPlayerCore } from '../client';
import { AudioDownload } from '../desktop/download';
import { Polling } from '../infra/polling';
import { KeyMap } from '../infra/keymap';
import { openDialog } from '../infra/file-dialog';


@Component({
    components: {
        SearchPane,
        PlaylistPane,
        VolumeControl,
        ControlPanel,
        AppContextMenu,
        ProgressBar
    }
})
class IApp extends Vue {
    @Prop state: AppState

    status = 'ready'
    curPlaying: Track = undefined
    controls: PlayerControls = undefined
    playlist = Playlist.restore()
    playlists = []
    uploadedTrackIds = []
    ongoing = {upload: undefined, download: undefined}
    show = {playlist: true, playlists: false}
    monitor: Polling
    init = false

    client: ClientPlayerCore = undefined

    @Ref searchPane: any
    @Ref playlistPane: any
    @Ref controlPanel: IControlPanel
    @Ref menu: IAppContextMenu

    local: {controls: PlayerControls}

    mounted() {
        this.init = true;
        this.monitor = new Polling(() => this._refreshStatus(), 500)
        this.monitor.start();
        this.$watch(() => this.controlPanel.expand,
                e => this.monitor.every = e ? 500 : 3600e3,
            {immediate: true});
    }

    @Watch('controls')
    async co(controls: PlayerControls) {
        controls = toRaw(controls);
        this.state.volume = await controls.volume.delegate();
        /** @todo get rid of this messy global */
        Object.assign(window, {controls});
    }

    _refreshStatus() {
        this.controls?.getStatus(s => {
            this.controlPanel.status = s;
            let track = (s as any).track;
            if (track) {
                this.curPlaying = {id: track} as Track;
            }
        });
    }

    get focused() { 
        return this.init ? this.menu?.for?.item : undefined;
    }

    get spotlight() {
        return {
            active: this.curPlaying && YoutubeItem.id(this.curPlaying),
            focused: this.focused
        };
    }

    search(query, opts) {
        return this.searchPane.search(query, opts);
    }

    async startTrack(item, opts) {
        var self = this, operation;
        this.status = 'pending';
        this.curPlaying = item;

        try {
            if (item.id.kind === 'youtube#playlist') {
                this.status = 'playing';
                await this.playlistPane.importPlaylist(item.id.id);
            }
            else if (this.playlist?.has(item)) {
                await playerCore.watchFromList(
                    this.playlist.export(item),
                        {...opts, onend: () => this.playNext()});
            }
            else {
                await playerCore.watch(item.uri || YoutubeItem.id(this.curPlaying), opts);
            }
            this.status = 'playing';
        }
        catch (e) {
            console.error(e); self.status = 'error';
        }
    }

    playNext() {
        let curIndex = this.playlist.indexOf(this.curPlaying as Playlist.Track);
        if (curIndex >= 0 && curIndex < this.playlist.tracks.length - 1) {
            this.startTrack(this.playlist.tracks[curIndex + 1], {autoplay: true});
        }
    }

    async openPlaylist(playlistData: object, opts: any = {}) {
        let playlist = await this.playlistPane.openPlaylist(playlistData);
        this.show.playlist = true;
        if (opts.autoplay)
            this.startTrack(playlist.tracks[playlist.nowPlaying], opts);
        return playlist;
    }

    /** REMOTE PART **/

    connect() {
        this.local ??= {controls: this.controls};
        this.client = new ClientPlayerCore();
        this.client.upload.remoteKeys = this.uploadedTrackIds;
        this.controls = new ClientPlayerControls();
    }

    disconnect() {
        this.client = undefined;
        this.controls = this.local.controls;
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
                    this._monitorProgress('upload', {title: file.name}),
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
        DroppedFiles.fromDataTransfer(dt).then((files) =>
            this.uploadMultiple(files));
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

    _monitorProgress(prop /* 'upload'|'download' */, obj: {title?: string, progress?: {total: number, loaded: number}} = {}) {
        var o = this.ongoing;
        o[prop] = obj;
        obj = o[prop]; // get the reactive proxy
        return function(p, fn) {
            if (fn) obj.title = fn;
            if (p)
                obj.progress = {total: p.total, loaded: p.loaded ?? p.uploaded};
            else
                o[prop] = undefined;
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
            this.download([action.for.item]);
            break;
        case 'connect':
            this.connect();
            break;
        case 'disconnect':
            this.disconnect();
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

    download(items?) {
        items ??= this.playlist.tracks;
        return AudioDownload.do(items, {},
            this._monitorProgress('download'));
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

    /** KEYMAP PART **/

    globalKeyMap() {
        return new KeyMap({
            'Mod-S': () => this.playlist.download(),
            'Mod-O': () => { this.openPlaylistDialog(); },
            'Mod-L': () => { /* set focus to search bar */ }
        })
    }

    async openPlaylistDialog() {
        let fl = await openDialog('.json');
        this.upload(fl, fl.name);
    }
}


export { IApp }
export default toNative(IApp)
</script>