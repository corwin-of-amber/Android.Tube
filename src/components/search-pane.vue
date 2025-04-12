<template>
    <div class="search-ui">
        <div id="search-box">
            <input ref="query" v-model="state.query" @keydown.enter="blur()">
            <search-button @click="selectAll"/>
        </div>
        <div id="search-results" class="list">
            <template v-for="item in state.results">
                <track-snippet
                    :item="item" :spotlight="spotlightOf(item)"
                    @click="$emit('selected', item)"
                    @swipe="$emit('swipe', item)"/>
            </template>
        </div>
    </div>
</template>

<script>
import _ from 'lodash';
import TrackSnippet from './track-snippet.vue';
import SearchButton from './search-button.vue';
import { YoutubeItem } from '../player';


export default {
    props: ['state', 'spotlight'],
    created() {
        this.performSearch = _.debounce(this._performSearch, 500);
    },
    methods: {
        parse(query) {
            return query?.startsWith("'") ?
                [query.slice(1), {scope: 'local'}] : [query, {}];
        },
        unparse(query, opts) {
            return (opts?.scope === 'local' ? "'" : '') + query;
        },
        search(query, opts) {
            this.state.query = query;
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
                self.state.results = res.items;
                return res;
            });
        },
        blur() {
            this.$refs.query.blur();
            this.performSearch.flush();
        },
        selectAll() {
            this.$refs.query.select();
        },

        spotlightOf(track) { /** @oops duplicated from <search-pane> */
            let id = YoutubeItem.id(track);
            return id ? {active:  id === this.spotlight.active,
                         focused: track === this.spotlight.focused} : {};
        }
    },
    watch: {
        'state.query'(newValue, oldValue) {
            let [query, opts] = this.parse(newValue);
            if (query.length > 2)
                this.performSearch(query, opts);
        }
    },

    components: {
        TrackSnippet, SearchButton
    }
}
</script>