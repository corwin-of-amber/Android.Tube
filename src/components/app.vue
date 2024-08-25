<template>
    <search-pane ref="search" :spotlight="{}"></search-pane>
</template>

<script>
import SearchPane from './search-pane.vue';

export default {
    props: ['data'],
    mounted() {
        this.$refs.search.searchResults = this.data.tracks;
    },
    components: {
        SearchPane
    }
}
</script>