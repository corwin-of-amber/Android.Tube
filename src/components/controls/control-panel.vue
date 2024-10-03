<template>
    <div class="control-panel" :class="{expand}">
        <div class="controls">
            <sleep-timer v-model:state="state.sleep"/>
            <!-- <playlist-button ref="playlist" :show="show"/> -->
            <play-pause-button ref="playPause"/>
            <position-bar ref="position"/>
        </div>
        <button @click="toggle">≣</button>
    </div>
</template>

<style scoped>
.controls > .sleep-timer {
    margin-right: 1em;
}
</style>

<script>
import PlayPauseButton from './play-pause-button.vue';
import PositionBar from './position-bar.vue';
import SleepTimer from './sleep-timer.vue'

export default {
    props: ['state', 'show'],
    data: function() { return {expand: true, status: {}, monitorInterval: 500}; },
    methods: {
        toggle() {
            this.expand = !this.expand;
            this.expand ? this.monitor() : this.unmonitor();
        },
        monitor() {
            if (this._monitor) return;
            var h;
            this._monitor = setInterval(h = () => {
                //controls.getStatus(s => { this.status = s; });
            }, this.monitorInterval);
            h();
        },
        unmonitor() {
            if (this._monitor) {
                clearInterval(this._monitor);
                this._monitor = null;
            }
        }
    },
    mounted() {
        if (this.expand) this.monitor();
    },
    components: {
        PlayPauseButton, PositionBar, SleepTimer
    }
}
</script>