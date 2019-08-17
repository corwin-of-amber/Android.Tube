'use strict';


const key = 'AIzaSyAa8yy0GdcGPHdtD083HiGGx_S0vMPScDM',
      api_endpoint = 'https://content.googleapis.com/youtube/v3',
      api_origin = 'https://explorer.apis.google.com';

function yapi(action, params) {
    var url=`${api_endpoint}/${action}?${$.param(params)}&key=${key}`;
    return new Promise(function(resolve, reject) {
        $.getJSON({url: url, headers: {'X-Origin': api_origin}})
        .done(function(data) { resolve(data); })
        .fail(function(jq) { reject(jq.responseJSON); });
    });
}

yapi.search = function(query) {
    return this('search', {maxResults: 50, part: 'snippet', q: query});
}

yapi.page = function(pageToken) {
    return this('search', {maxResults: 50, part: 'snippet', pageToken: pageToken});
}

yapi.details = function(videoId) {
    return this('videos', {part: 'contentDetails', id: videoId})
        .then(function(res) {
            var item = res.items[0];
            return item ? res.items[0].contentDetails : Promise.reject(`not found: '${videoId}'`);
        });
}


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
    <button>
        <svg viewBox="0 0 24 24" focusable="false" style="pointer-events: none;"><g>
            <path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z" class="style-scope yt-icon"></path>
        </g></svg>
    </button>
    `
});

Vue.component('video-snippet', {
    props: ['item'],
    data() { return {duration: undefined}; },
    created() { this.fetchDetails(); },
    watch: {
        item() { this.fetchDetails(); }
    },
    template: `
        <p class="video-snippet" @click="$emit('click')">
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
            });
        },
        timestamp(pt) {
            var mo = pt.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
            var h = mo[1], m = mo[2] || '0', s = mo[3] || '0';

            return [h, m, s].filter(function(x) { return x; })
                .map(function(x) {return x.padStart(2, '0'); }).join(':');
        }
    }
});

Vue.component('search-ui', {
    data: function() { return {
        searchQuery: '',
        searchResults: []
    }; },
    created() {
        this.performSearch = _.debounce(this._performSearch, 500);
    },
    methods: {
        search(query) {
            this.searchQuery = query;
            this._performSearch(query);  // invoke search immediately
        },
        _performSearch(query) {
            if (this._lastSearch === query) return; // perf
            else this._lastSearch = query;

            const self = this;
            yapi.search(query).then(function(res) {
                self.searchResults = res.items;
            });
        },
        blur() {
            $(this.$el).find('input').blur();
        }
    },
    watch: {
        searchQuery(newValue, oldValue) {
            if (newValue.length > 2)
                this.performSearch(newValue);
        }
    },
    template: `
        <div>
            <div id="search-box">
                <input v-model="searchQuery" @keydown.enter="blur()">
                <search-button/>
            </div>
            <div id="search-results">
                <template v-for="item in searchResults">
                    <video-snippet v-if="item.id.kind === 'youtube#video'"
                        :item="item" @click="$emit('selected', item)"/>
                </template>
            </div>
        </div>
    `
});


var app;

$(function() {
    app = new Vue({
        el: '#ui-container',
        template: `
            <div id="ui-container">
                <volume-control ref="volume"></volume-control>
                <search-ui ref="search" @selected="watch"></search-ui>
            </div>
        `,
        methods: {
            search(query) {
                this.$refs.search.search(query);
            },
            watch(item) {
                watch(item.id.videoId);
            }
        }
    });
});