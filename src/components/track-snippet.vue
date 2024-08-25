<template>
    <p class="video-snippet" :class="spotlight || {}" @click="$emit('click')"
            draggable="true" @dragstart="dragStart" @contextmenu.prevent="menu">
        <span class="title" v-html="item.snippet.title"/>
        <span class="duration" v-if="duration">{{timestamp(duration)}}</span>
    </p>
</template>


<script>
export default {
    props: ['item', 'spotlight'],
    data() { return {duration: undefined}; },
    created() { this.fetchDetails(); },
    watch: {
        item() { this.fetchDetails(); }
    },
    methods: {
        fetchDetails() {
            this.duration = undefined;
            if (this.item.contentDetails) {
                this.duration = this.item.contentDetails.duration;
            }
            else if (this.item.kind == 'youtube#searchResult') {
                var self = this;
                self.duration = -1;
                /** @todo need to coalesce requests to avoid quota excess */
                /*
                yapi.details(this.item.id.videoId).then(function(res) {
                    self.duration = res.duration;
                })
                .catch(function(e) { console.error(e); self.duration = -1; })
                */
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
}
</script>