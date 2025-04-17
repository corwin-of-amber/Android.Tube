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
import { Polling } from '../../infra/polling';

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
    monitor = new  Polling(() => this._refresh(), 500)
    monitorInterval = 500
    _monitor: any

    toggle() {
        this.expand = !this.expand;
    }

    _refresh() {
        let controls = (window as any).controls; /** @todo */
        controls?.getStatus(s => { this.status = s; });
    }

    sleepToggle() {
        if (this.state.sleep.isRunning)
            this.state.sleep.stop();
        else
            this.state.sleep.start();
    }

    @Watch('expand', {immediate: true})
    _monitorSetup(expand: boolean) {
        expand ? this.monitor.start() : this.monitor.stop();
    }
}

export default toNative(IControlPanel)
</script>