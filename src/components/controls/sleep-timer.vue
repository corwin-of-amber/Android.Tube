<template>
    <span class="sleep-timer">
        <span class="indicator" :class="{isRunning: state.isRunning}">🌙</span>
        <span class="mins">{{ state.mins }}</span>
    </span>
</template>

<style scoped>
.indicator { margin-right: .3em; }
.indicator:not(.isRunning) {
    color: transparent;
    text-shadow: 0 0 0 #666;
}
.mins { font-size: 80%; }
</style>

<script lang="ts">
import { Vue, Component, Prop, toNative } from 'vue-facing-decorator';

@Component
export class ISleepTimer extends Vue {
    @Prop
    state = {mins: 45, isRunning: false }
}

export default toNative(ISleepTimer)
</script>