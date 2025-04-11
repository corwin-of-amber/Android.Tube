<template>
    <p class="video-snippet" :class="spotlight || {}"
            draggable="true" @dragstart="dragStart"
            @contextmenu.prevent.stop="menu">
        <span class="title" v-html="item.title ?? item.snippet?.title ?? '(no title)'"></span>
        <span class="duration" v-if="item.duration !== undefined">{{timestamp(item.duration)}}</span>
    </p>
</template>


<script>
import { YoutubeItem } from '../player';

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
                /** @todo need to coalesce requests to avoid quota excess */
                /*
                yapi.details(this.item.id.videoId).then(function(res) {
                    self.duration = res.duration;
                })
                .catch(function(e) { console.error(e); self.duration = -1; })
                */
            }
        },
        timestamp(hms) {
            return hms ? hms.filter(x => x != undefined)
                            .map(x => x.toString().padStart(2, '0')).join(':')
                       : "--:--";
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
            /* should probably issue an action event instead and handle in App instead */
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
            }
        }
    }
}
</script>