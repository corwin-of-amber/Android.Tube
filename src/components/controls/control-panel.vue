<template>
    <div class="control-panel" :class="{expand}">
        <div class="controls">
            <sleep-timer :state="state.sleep" @toggle="sleepToggle"/>
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

<script lang="ts">
import { Vue, Component, Prop, Watch, toNative } from 'vue-facing-decorator';
import PlayPauseButton from './play-pause-button.vue';
import PositionBar from './position-bar.vue';
import SleepTimer from './sleep-timer.vue'

@Component({
    components: {
        PlayPauseButton, PositionBar, SleepTimer
    }
})
export class IControlPanel extends Vue {
    @Prop state: any
    @Prop show: any

    expand = true
    status = {}
    monitorInterval = 500
    _monitor: any

    toggle() {
        this.expand = !this.expand;
    }

    monitor() {
        if (!this._monitor) {
            let h = () => {
                let controls = (window as any).controls; /** @todo */
                controls?.getStatus(s => { this.status = s; });
            };
            this._monitor = setInterval(h, this.monitorInterval);
            h();
        }
    }
    unmonitor() {
        if (this._monitor) {
            clearInterval(this._monitor);
            this._monitor = null;
        }
    }

    sleepToggle() {
        if (this.state.sleep.isRunning)
            this.state.sleep.stop();
        else
            this.state.sleep.start();
    }

    @Watch('expand', {immediate: true})
    _monitorSetup(expand: boolean) {
        expand ? this.monitor() : this.unmonitor();
    }
}

export default toNative(IControlPanel)
</script>