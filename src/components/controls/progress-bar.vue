<template>
    <div class="progress-bar">{{title}}
        <span v-if="progress?.total">{{percentage()}}%</span>
    </div>
</template>

<script lang="ts">
import { Vue, Component, Prop, toNative } from 'vue-facing-decorator';

@Component
class IProgressBar extends Vue {
    @Prop title: string
    @Prop progress: {total: number, loaded: number}

    percentage() {
        return (100 * this.progress.loaded / this.progress.total).toFixed(1);
    }
}

export { IProgressBar }
export default toNative(IProgressBar);
</script>