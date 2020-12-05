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
    props: ['item', 'active'],
    data() { return {duration: undefined}; },
    created() { this.fetchDetails(); },
    watch: {
        item() { this.fetchDetails(); }
    },
    template: `
        <p class="video-snippet" :class="{active: active}" @click="$emit('click')"
                draggable="true" @dragstart="dragStart">
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
        }
    }
});

Vue.component('search-ui', {
    props: ['active'],
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
                        :item="item" :active="itemId(item) === active"
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
        itemId(item) {
            return typeof item.id === 'string' ? item.id : item.id.videoId;
        },
        itemKind(item) {
            return typeof item.id === 'string' ? item.kind : item.id.kind;
        },
        blur() {
            $(this.$el).find('input').trigger('blur');
        },
        selectAll() {
            this.$refs.query.select();
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
        data: {curPlaying: undefined, playlist: undefined, playlists: [], status: 'ready', uploading: undefined,
               show: {playlist: true, playlists: false}},
        template: `
            <div id="ui-container" :class="status" @dragover="dragOver" @drop="drop">
                <volume-control ref="volume"/>
                <control-panel ref="controls" :show="show"/>
                <search-ui ref="search" @selected="watch" :active="curPlaying"/>
                <playlist-ui v-if="playlist && show.playlist"
                    ref="playlist" :playlist="playlist" :show="show"
                    @selected="watch" :active="curPlaying"/>
                <playlist-ui-index v-if="show.playlists"
                    ref="playlists" :playlists="playlists"
                    @selected="loadPlaylist" :active="playlist && playlist.id"/>
                <div v-if="uploading" class="upload-progress">{{uploading.filename}}
                    <span v-if="uploading.progress">{{(100 * uploading.progress.uploaded / uploading.progress.total).toFixed(1)}}%</span>
                </div>
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
        },
        methods: {
            search(query) {
                return this.$refs.search.search(query);
            },
            watch(item) {
                var self = this, operation;
                this.status = 'pending';
                this.curPlaying = this.$refs.search.itemId(item);
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

            openPlaylist(playlist) {
                if (!playlist instanceof Playlist)
                    playlist = Playlist.from(playlist);
                this.playlist = playlist;
                this.show.playlist = true;
                this.playlist.store();
            },
            loadPlaylist(entry, play) {
                var self = this;
                Playlist.loadFromServer(entry.id).then(function(playlist) {
                    self.playlist = playlist;
                    if (play && playerCore.watchFromList)
                        playerCore.watchFromList(playlist.export(0));
                });
            },

            importPlaylist(youtubePlaylistId) {
                var self = this;
                yapi.playlistItemsAll(youtubePlaylistId).then(function(items) {
                    self.playlist = new Playlist('Imported').importYoutube(items);
                });
            },

            upload(file, name) {
                var self = this;
                if (file.type == 'application/json') {
                    Playlist.upload(file).then(function(playlist) {
                        self.playlist = playlist;
                    });
                }
                else if (file.type.match(/^(audio|video)[/]/) ||
                         file.name.match(/[.](mkv)$/)) {
                    this.uploading = {filename: file.name, progress: undefined};
                    return playerCore.upload(file, function(p) { 
                        self.uploading.progress = p; 
                    }, name)
                    .finally(function() { self.uploading = undefined; });
                }
                else console.warn("unrecognized file type: " + file.type);
            },

            uploadMultiple(files) {
                var conts = [], _this = this;
                for (var i = 0; i < files.length; i++) {
                    conts.push((function(f, id) {
                        return function() {
                            return _this.upload(f, id).then(function(track) {
                                console.log('enqueue', track);
                                playerCore.enqueue(track);
                            });
                        }
                    })(files[i], 'c'+i));
                }
                conts.reduce(function(p, cont) {
                    return p.then(cont);
                }, Promise.resolve());
            },

            dragOver(ev) { ev.preventDefault(); },
            drop(ev) {
                ev.preventDefault();
                if (ev.dataTransfer.files.length > 0)
                    this.uploadMultiple(ev.dataTransfer.files)
                else if (this.$refs.playlist)
                    this.$refs.playlist.dropAway(ev);
            }
        }
    });
});

// Prevents window from moving on touch on newer browsers.
window.addEventListener('touchmove', function (event) {
    if ($(event.target).closest('.search-ui').length === 0 &&
        event.target.className !== 'volume-control')
        event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
}, {passive: false});
