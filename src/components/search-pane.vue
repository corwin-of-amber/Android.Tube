<template>
    <div class="search-ui">
        <div id="search-box">
            <input ref="query" v-model="state.query" @keydown.enter="blur()">
            <search-button @click="selectAll"/>
        </div>
        <div id="search-results" class="list">
            <template v-for="item in state.results">
                <track-snippet
                    :item="item" :spotlight="spotlightOf(item.id)"
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
    props: ['state', 'spotlight'],
    created() {
        this.performSearch = _.debounce(this._performSearch, 500);
    },
    methods: {
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

        spotlightOf(id) {
            return id ? {active:  id === this.spotlight.active,
                         focused: id === this.spotlight.focused} : {};
        }
    },
    watch: {
        'state.query'(newValue, oldValue) {
            if (newValue.length > 2)
                this.performSearch(newValue);
        }
    },

    components: {
        TrackSnippet, SearchButton
    }
}
</script>