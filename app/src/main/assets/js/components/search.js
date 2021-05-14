'use strict';

// ES8 polyfill
if (!String.prototype.padStart)
    String.prototype.padStart = function(length, padString) {
                                    var str = this;
                                    while (str.length < length)
                                        str = padString + str;
                                    return str;
                                }


Vue.component('search-button', {
    template: `
    <button @click="$emit('click')">
        <svg viewBox="0 0 24 24" focusable="false" style="pointer-events: none;"><g>
            <path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z" class="style-scope yt-icon"></path>
        </g></svg>
    </button>
    `
});

Vue.component('video-snippet', {
    props: ['item', 'spotlight'],
    data() { return {duration: undefined}; },
    created() { this.fetchDetails(); },
    watch: {
        item() { this.fetchDetails(); }
    },
    template: `
        <p class="video-snippet" :class="spotlight || {}" @click="$emit('click')"
                draggable="true" @dragstart="dragStart" @contextmenu.prevent="menu">
            <span class="title" v-html="item.snippet.title"/>
            <span class="duration" v-if="duration">{{timestamp(duration)}}</span>
        </p>
    `,
    methods: {
        fetchDetails() {
            this.duration = undefined;
            if (this.item.contentDetails) {
                this.duration = this.item.contentDetails.duration;
            }
            else if (this.item.kind == 'youtube#searchResult') {
                var self = this;
                yapi.details(this.item.id.videoId).then(function(res) {
                    self.duration = res.duration;
                })
                .catch(function(e) { console.error(e); self.duration = -1; })
            }
        },
        timestamp(pt) {
            if (pt === -1) return "--:--";

            var mo = pt.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
            if (mo) {
                var h = mo[1], m = mo[2] || '0', s = mo[3] || '0';

                return [h, m, s].filter(function(x) { return x; })
                    .map(function(x) {return x.padStart(2, '0'); }).join(':');
            }
            else return "--:--";
        },
        dragStart(ev) {
            ev.dataTransfer.setData("json", JSON.stringify(this.item));
        },
        swipeStart(ev) {
            ev.preventDefault();
            this._swipe = {x: ev.offsetX, y: ev.offsetY};
        },
        swipeEnd(ev) {
            if (this._swipe) {
                var box = this.$el.getBoundingClientRect();
                if (Math.abs(ev.offsetY - this._swipe.y) < box.height &&
                    Math.abs(ev.offsetX - this._swipe.x) > box.width / 2) {
                    console.log('swipe', this.item);
                    this.$emit('swipe', this.item);
                }
            }
        },
        menu(ev) {
            if (this.$root.$refs.menu)
                this.$root.$refs.menu.open(ev, this);
        },
        action(action) {
            function copy(v) {
                console.log(v); navigator.clipboard.writeText(v);
            }
            switch (action.type) {
            case 'copy-id': copy(YoutubeItem.id(this.item)); break;
            case 'copy-url': copy(YoutubeItem.webUrl(this.item)); break;
            case 'set-global': window.sel = this.item; break;
            }
        }
    }
});

Vue.component('search-ui', {
    props: ['spotlight'],
    data: function() { return {
        searchQuery: '',
        searchResults: []
    }; },
    template: `
        <div class="search-ui">
            <div id="search-box">
                <input ref="query" v-model="searchQuery" @keydown.enter="blur()">
                <search-button @click="selectAll"/>
            </div>
            <div id="search-results" class="list">
                <template v-for="item in searchResults">
                    <video-snippet v-if="itemKind(item) === 'youtube#video'"
                        :item="item" :spotlight="spotlightOf(itemId(item))"
                        @click="$emit('selected', item)"
                        @swipe="$emit('swipe', item)"/>
                </template>
            </div>
        </div>
    `,    
    created() {
        this.performSearch = _.debounce(this._performSearch, 500);
    },
    methods: {
        search(query) {
            this.searchQuery = query;
            return this._performSearch(query);  // invoke search immediately
        },
        _performSearch(query) {
            if (this._lastSearch === query) return this._lastResult; // perf
            else this._lastSearch = query;

            var self = this;
            return this._lastResult = yapi.search(query).then(function(res) {
                self.searchResults = res.items;
                return res;
            });
        },
        itemId(item) { return YoutubeItem.id(item); },
        itemKind(item) { return YoutubeItem.kind(item); },
        blur() {
            $(this.$el).find('input').trigger('blur');
        },
        selectAll() {
            this.$refs.query.select();
        },

        spotlightOf(id) {
            return id ? {active:  id === this.spotlight.active,
                         focused: id === this.spotlight.focused} : {};
        }
    },
    watch: {
        searchQuery(newValue, oldValue) {
            if (newValue.length > 2)
                this.performSearch(newValue);
        }
    }
});


var app;

$(function() {
    app = new Vue({
        el: '#ui-container',
        data: {curPlaying: undefined, playlist: undefined, playlists: [],
               status: 'ready',
               uploadedTrackIds: [],
               ongoing: {upload: undefined, download: undefined},
               show: {playlist: true, playlists: false},
               init: false},
        template: `
            <div id="ui-container" :class="status" @dragover="dragOver" @drop="drop">
                <volume-control ref="volume"/>
                <control-panel ref="controls" :show="show"/>
                <search-ui ref="search" @selected="watch" :spotlight="spotlight"/>
                <playlist-ui v-if="playlist && show.playlist"
                    ref="playlist" v-model="playlist" :show="show"
                    @selected="watch" :spotlight="spotlight" :uploadedTrackIds="uploadedTrackIds"/>
                <playlist-ui-index v-if="show.playlists"
                    ref="playlists" :playlists="playlists"
                    @selected="loadPlaylist" :active="playlist && playlist.id"/>
                <div v-if="ongoing.upload" class="upload-progress">{{ongoing.upload.filename}}
                    <span v-if="ongoing.upload.progress">{{(100 * ongoing.upload.progress.uploaded / ongoing.upload.progress.total).toFixed(1)}}%</span>
                </div>
                <div v-if="ongoing.download" class="download-progress">{{ongoing.download.filename}}
                </div>
                <span style="position: absolute" v-if="hasContextMenu"> <!-- @oops hack to enable using CSS ':last-of-type' :/ -->
                    <app-context-menu ref="menu" @action="menuAction"/>
                </span>
            </div>
        `,
        mounted() {
            let self = this;

            if (typeof Playlist !== 'undefined')
                this.playlist = Playlist.restore();

            playerCore.playlists().then(function(playlists) {
                self.playlists = playlists;
            });
            
            this.$refs.controls.$watch('status', function(status) {
                if (status.track) self.curPlaying = status.track;
            });

            this.init = true; // enable computed prop `focused` that was delayed until now to give `$refs.menu` a chance to load
        },
        computed: {
            hasContextMenu() { return typeof AppContextMenu != 'undefined'; },
            focused() { var v = this.init && this.$refs.menu; return v && v.for && YoutubeItem.id(v.for.item); },
            spotlight() { return {active: this.curPlaying, focused: this.focused}; }
        },
        methods: {
            search(query) {
                return this.$refs.search.search(query);
            },
            watch(item) {
                var self = this, operation;
                this.status = 'pending';
                this.curPlaying = YoutubeItem.id(item);
                if (this.playlist && this.playlist.id && item._playlist === this.playlist.id && playerCore.watchFromList) {
                    operation = playerCore.watchFromList(this.playlist.export(item));
                }
                else {
                    operation = playerCore.watch(item.uri || this.curPlaying);
                }
                operation
                    .catch(function() { self.status = 'error'; })
                    .then(function() { self.status = 'playing'; });
            },
            playNext() {
                if (this.curPlaying && this.playlist) {
                    var index = this.playlist.tracks.findIndex(t => 
                        YoutubeItem.id(t) === this.curPlaying);
                    if (index >= 0 && index < this.playlist.tracks.length - 1) {
                        this.watch(this.playlist.tracks[index + 1]);
                    }
                }
            },

            newPlaylist() {
                this.$refs.playlist.newPlaylist();
                this.show.playlist = true;
            },
            openPlaylist(playlist) {
                this.$refs.playlist.openPlaylist(playlist);
                this.show.playlist = true;
            },
            loadPlaylist(entry, play) {
                this.$refs.playlist.loadPlaylist(entry.id).then(function(playlist) {
                    if (play && playerCore.watchFromList)
                        playerCore.watchFromList(playlist.export(0));
                });
            },
            importPlaylist(youtubePlaylistId) {
                this.$refs.playlist.importPlaylist(youtubePlaylistId);
                this.show.playlist = true;
            },
            importTracks(item) {
                this.$refs.playlist.importTracks(item);
                this.show.playlist = true;
            },

            upload(file, name) {
                var hasFS = (typeof process !== 'undefined');   // NWjs
                if (file.type == 'application/json') {
                    this.$refs.playlist.openPlaylist(file);
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
            },

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
            },

            droppedFiles(dt) {
                var _this = this;
                DroppedFiles.fromDataTransfer(dt).then(function(files) {
                    _this.uploadMultiple(files);
                });
            },

            dragOver(ev) { ev.preventDefault(); },
            drop(ev) {
                ev.preventDefault();
                if (ev.dataTransfer.files.length > 0)
                    this.droppedFiles(ev.dataTransfer);
                else if (this.$refs.playlist)
                    this.$refs.playlist.dropAway(ev);
            },

            _monitorProgress(prop /* 'upload'|'download' */, init = {}) {
                var obj = init, o = this.ongoing;
                obj.progress = undefined;
                o[prop] = obj;
                return function(p, fn) {
                    if (fn) obj.filename = fn;
                    if (p) obj.progress = p; else o[prop] = undefined;
                };
            },

            connect() {
                this.client = new ClientPlayerCore();
                this.uploadedTrackIds = this.client.upload.remoteKeys;
            },

            menuAction(action) {
                if (action.for) action.for.action(action); /** @oops oh my */
                switch (action.type) {
                case 'playlist-new':
                    this.newPlaylist();
                    break;
                case 'set-global':
                    console.log('temp1', window.temp1 = action.for.item);
                    break;
                case 'download':
                    AudioDownload.do(action.for.item);
                    break;
                case 'connect':
                    this.connect();
                    break;
                case 'play-remote':
                    if (!this.client) this.connect();
                    var item = action.for.item,
                        idx = this.playlist ? this.playlist.tracks.indexOf(item) : 0;
                    if (item) {
                        this.client.upload.tracks([item],
                            this._monitorProgress('upload'), Math.max(idx, 0),
                            false, 'play');
                    }
                    break;
                case 'play-remote-all':
                    if (!this.client) this.connect();
                    var item = action.for.item;
                    item = item.remote || item;
                    if (item) {
                        this.client.watchFromList(this.playlist.export(item));
                    }
                    break;
                case 'upload':
                    if (!this.client) this.connect();
                    var item = action.for.item,
                        idx = this.playlist ? this.playlist.tracks.indexOf(item) : 0;
                    if (item) {
                        this.client.upload.tracks([item],
                            this._monitorProgress('upload'), Math.max(idx, 0),
                            true /* force upload */);
                    }
                    break;
                }
            },
        },
        components: typeof AppContextMenu == 'undefined' ? {} : {AppContextMenu}
    });
});

function waterfall(conts) {
    return conts.reduce(function(p, cont) {
        return p.then(cont);
    }, Promise.resolve());
}

// Prevents window from moving on touch on newer browsers.
var SCROLLABLE_ELEMS = '.search-ui, .playlist-ui, .playlist-ui-index';

window.addEventListener('touchmove', function (event) {
    if ($(event.target).closest(SCROLLABLE_ELEMS).length === 0 &&
        event.target.className !== 'volume-control')
        event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
}, {passive: false});
