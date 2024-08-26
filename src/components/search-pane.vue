<template>
    <div class="search-ui">
        <div id="search-box">
            <input ref="query" v-model="searchQuery" @keydown.enter="blur()">
            <search-button @click="selectAll"/>
        </div>
        <div id="search-results" class="list">
            <template v-for="item in searchResults">
                <track-snippet v-if="isVisible(item)"
                    :item="item" :spotlight="spotlightOf(itemId(item))"
                    @click="$emit('selected', item)"
                    @swipe="$emit('swipe', item)"/>
            </template>
        </div>
    </div>
</template>

<script>
import _ from 'lodash';
import { YoutubeItem } from '../player';
import TrackSnippet from './track-snippet.vue';
import SearchButton from './search-button.vue';


export default {
    props: ['spotlight'],
    data: () => ({
        searchQuery: '',
        searchResults: []
    }),
    created() {
        this.performSearch = _.debounce(this._performSearch, 500);
    },
    methods: {
        search(query, opts) {
            this.searchQuery = query;
            try {
                return this._performSearch(query, opts);  // invoke search immediately
            }
            finally {
                // This is to prevent the change of `searchQuery` from firing another
                // `performSearch`...  @oops
                setTimeout(() => this.performSearch.cancel(), 0);
            }
        },
        _performSearch(query, opts) {
            let k = JSON.stringify([query, opts || {}]);
            if (this._lastSearch === k) return this._lastResult; // perf
            else this._lastSearch = k;

            var self = this;
            var use = SEARCH_SCOPES[opts && opts.scope] || SEARCH_SCOPES['default'];
            return this._lastResult = use.search(query).then(function(res) {
                self.searchResults = res.items;
                return res;
            });
        },
        isVisible(item) { return ['youtube#video', Playlist.KIND.LOCAL].includes(this.itemKind(item)); },
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
    },

    components: {
        TrackSnippet, SearchButton
    }
}
</script>