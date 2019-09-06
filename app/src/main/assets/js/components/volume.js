
Vue.component('volume-control', {
    data: function() { return {level: 500, max: 1000}; },
    template: `
        <input type="range" class="volume-control" v-model.number="level" min="0" :max="max">
    `,
    mounted() {
        var self = this;
        if (typeof mainActivity !== 'undefined') {
            this.$watch('level', function(level) {
                mainActivity.setVolume(level, self.max);
            });
        }
    }
});