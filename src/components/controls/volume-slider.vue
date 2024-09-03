<template>
    <input type="range" class="volume-control"
        v-model.number="modelValue.level" min="0" :max="modelValue.max" @wheel="wheel">  
</template>

<style>
input.volume-control {
    appearance: none;
    -webkit-appearance: none;
    transform: rotate(270deg);
    background: #fff;
}

input.volume-control::-webkit-slider-runnable-track {
    background: linear-gradient(to top left,
        #a7b2ce 0%, #a7b2ce 50%, #fff 51%, #fff 100%);
    height: 20px;
    border: none;
}

input.volume-control::-webkit-slider-thumb {
    -webkit-appearance: none;
    width: 50px;
    height: 30px;
    background: linear-gradient(to right,
        transparent 0%, transparent 30%, #999 30%, #ddd 40%, #ddd 45%, #bbb 50%, 
            #aaa 50%, #ddd 55%, #ddd 60%, #eee 70%, transparent 70%, transparent 100%);
    margin-top: -7px;
    border: none;
}
</style>

<script lang="ts">
import { Vue, Component, Prop, toNative } from 'vue-facing-decorator';

@Component
class IVolumeSlider extends Vue {
    @Prop modelValue: {level: number, max: number}
    
    wheel(ev) {
        let m = this.modelValue;
        m.level = Math.max(0, Math.min(m.max, m.level + ev.deltaY));
    }
}

export default toNative(IVolumeSlider)
</script>