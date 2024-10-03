<template>
    <button name="play-pause" @click="toggle">{{caption}}</button>
</template>

<script>
export default {
    data: function() { return {playing: false, error: undefined}; },
    computed: {
        caption() { return this.error ? "×" : this.playing ? "❙❙" : "▶︎"}
    },
    mounted() {
        var self = this;
        this.$parent.$watch('status', function(s) {
            self.error = s.error;
            if (s.playing != undefined) self.playing = s.playing;
        });
    },
    methods: {
        toggle() {
            if (this.playing ? controls.pause() : controls.resume())
                this.playing = !this.playing;
        }
    }
}
</script>