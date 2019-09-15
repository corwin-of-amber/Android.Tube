
Vue.component('volume-control', {
    data: function() { return {level: 500, max: 1000}; },
    template: `
        <input type="range" class="volume-control" v-model.number="level" min="0" :max="max">
    `,
    mounted() {
        var self = this;
        this.$watch('level', function(level) {
            controls.setVolume(level, self.max);
        });
    }
});


Vue.component('position-bar', {
    data: function() { return {pos: 0, total: 20, monitorInterval: 500}; },
    template: `
        <input type="range" class="position-bar" v-model.number="pos" min="0" :max="total">
    `,
    mounted() {
        var self = this;
        this.$watch('pos', function(pos) {
            if (pos !== self._pos) {
                controls.seek(pos);
            }
        });
    },
    methods: {
        monitor() {
            if (this._monitor) return;
            var self = this, h;
            this._monitor = setInterval(h = function() {
                controls.getPosition(function(p) {
                    self.pos = self._pos = p.pos;
                    self.total = p.total;
                });
            }, this.monitorInterval);
            h();
        },
        unmonitor() {
            if (this._monitor) {
                clearInterval(this._monitor);
                this._monitor = null;
            }
        }
    }
});


Vue.component('play-pause-button', {
    data: function() { return {playing: false}; },
    template: `
        <button name="play-pause" @click="toggle">{{caption}}</button>
    `,
    computed: {
        caption() { return this.playing ? "❙❙" : "▶︎"}
    },
    methods: {
        toggle() {
            if (this.playing ? controls.pause() : controls.resume())
                this.playing = !this.playing;
        }
    }
});


Vue.component('control-panel', {
    data: function() { return {expand: false}; },
    template: `
        <div class="control-panel" :class="{expand}">
            <div class="controls">
                <play-pause-button ref="playPause"/>
                <position-bar ref="position"/>
            </div>
            <button @click="toggle">≣</button>
        </div>
    `,
    methods: {
        toggle() {
            this.expand = !this.expand;
            this.expand ? this.monitor() : this.unmonitor();
        },
        monitor() { this.$refs.position.monitor(); },
        unmonitor() { this.$refs.position.unmonitor(); }
    },
    mounted() {
        if (this.expand) this.monitor();
    }
});


var controls;

if (typeof mainActivity !== 'undefined') {       /* In Android WebView */
    controls = {
        setVolume(level, max) {
            mainActivity.setVolume(level, max);
        },
        getPosition(cb) {
        }
    }
}
else if (typeof server_action !== 'undefined') {  /* In client browser */
    controls = {
        setVolume(level, max) {
            server_action('vol?' + level + '/' + max);
        },
        getPosition(cb) {
            server_action('pos').then(function(res) {
                var [p1, p2] = res.split('/');
                cb({pos: Number(p1), total: Number(p2)});
            });
        },
        seek(pos) {
            if (pos)
                server_action(`pos?${pos}`);
        },
        resume() { server_action('resume'); return true; },
        pause() { server_action('pause'); return true; }
    };
}
else {                                     /* In NWjs standalone app */
    var a;
    controls = {
        getPosition(cb) {
            a = $('audio')[0];
            cb(a ? {pos: a.currentTime * 1000, total: a.duration * 1000}
                 : {pos: 0, total: 0});
        },
        seek(pos) {
            if (a = $('audio')[0]) a.currentTime = pos / 1000;
        },
        resume() {
            if (a = $('audio')[0]) a.play();
            return !!a;
        },
        pause() {
            if (a = $('audio')[0]) a.pause();
            return !!a;
        }
    }
}