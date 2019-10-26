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
            const self = this;
            yapi.details(this.item.id.videoId).then(function(res) {
                self.duration = res.duration;
            })
            .catch(function(e) { console.error(e); self.duration = -1; })
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
            <div id="search-results">
                <template v-for="item in searchResults">
                    <video-snippet v-if="item.id.kind === 'youtube#video'"
                        :item="item" :active="item.id.videoId === active"
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

            const self = this;
            return this._lastResult = yapi.search(query).then(function(res) {
                self.searchResults = res.items;
                return res;
            });
        },
        blur() {
            $(this.$el).find('input').blur();
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
        data: {curPlaying: undefined, playlist: undefined, status: 'ready'},
        template: `
            <div id="ui-container" :class="status" @dragover="dragOver" @drop="drop">
                <volume-control ref="volume"/>
                <control-panel ref="controls" :playlist="playlist"/>
                <search-ui ref="search" @selected="watch" :active="curPlaying"/>
                <playlist-ui v-if="playlist && playlist.show"
                    ref="playlist" :playlist="playlist"
                    @selected="watch" :active="curPlaying"/>
            </div>
        `,
        mounted() {
            this.playlist = Playlist.restore();
        },
        methods: {
            search(query) {
                return this.$refs.search.search(query);
            },
            watch(item) {
                var self = this;
                this.status = 'pending';
                watch(this.curPlaying = item.id.videoId)
                .catch(function() { self.status = 'error'; })
                .then(function() { self.status = 'playing'; });
            },

            dragOver(ev) { ev.preventDefault(); },
            drop(ev) {
                if (this.$refs.playlist)
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
