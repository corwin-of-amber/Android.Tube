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
import { Vue, Component, Prop, toNative } from 'vue-facing-decorator';
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

    toggle() {
        this.expand = !this.expand;
    }

    sleepToggle() {
        if (this.state.sleep.isRunning)
            this.state.sleep.stop();
        else
            this.state.sleep.start();
    }
}

export default toNative(IControlPanel)
</script>