<template>
    <input type="range" class="position-bar" v-model.number="pos" min="0" :max="duration">
</template>

<script>
export default {
    data: function() { return {pos: 0, duration: 20}; },
    mounted() {
        var self = this;
        this.$watch('pos', function(pos) {
            if (pos !== self._pos) {
                controls.seek(pos);
            }
        });
        this.$parent.$watch('status', function(s) {
            var p = s.position;
            if (p) {
                self.pos = self._pos = p.pos;
                self.duration = p.duration;
            }
        });
    },
}
</script>