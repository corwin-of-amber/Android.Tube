
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


Vue.component('playlist-button', {
    props: ['playlist'],
    template: `
        <button name="show-playlist" @click="toggle"
            :class="{on: playlist && playlist.show}">[playlist]</button>
    `,
    methods: {
        toggle() {
            this.$set(this.playlist, 'show', !this.playlist.show);
        }
    }
});


Vue.component('control-panel', {
    props: ['playlist'],
    data: function() { return {expand: false}; },
    template: `
        <div class="control-panel" :class="{expand}">
            <div class="controls">
                <playlist-button ref="playlist" :playlist="playlist"/>
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
                var pos_total = res.split('/');
                cb({pos: Number(pos_total[0]), total: Number(pos_total[1])});
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