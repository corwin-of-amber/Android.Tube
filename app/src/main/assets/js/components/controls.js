'use strict';

Vue.component('volume-control', {
    data: function() { return {level: 500, max: 1000}; },
    template: `
        <input type="range" class="volume-control"
            v-model.number="level" min="0" :max="max" @wheel="wheel">
    `,
    mounted() {
        var self = this;
        this.$watch('level', function(level) {
            controls.setVolume(level, self.max);
        });
        controls.getVolume(function(vol) {
            self.level = vol.level * self.max / vol.max;
        });
    },
    methods: {
        wheel(ev) {
            this.level = Math.max(0, Math.min(this.max, this.level + ev.deltaY));
        }
    }
});


Vue.component('position-bar', {
    data: function() { return {pos: 0, duration: 20}; },
    template: `
        <input type="range" class="position-bar" v-model.number="pos" min="0" :max="duration">
    `,
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
});


Vue.component('play-pause-button', {
    data: function() { return {playing: false, error: undefined}; },
    template: `
        <button name="play-pause" @click="toggle">{{caption}}</button>
    `,
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
    data: function() { return {expand: false, status: {}, monitorInterval: 500}; },
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
        monitor() {
            if (this._monitor) return;
            var self = this, h;
            this._monitor = setInterval(h = function() {
                controls.getStatus(function(s) { self.status = s; });
            }, this.monitorInterval);
            h();
        },
        unmonitor() {
            if (this._monitor) {
                clearInterval(this._monitor);
                this._monitor = null;
            }
        }
    },
    mounted() {
        if (this.expand) this.monitor();
    }
});


class AndroidAppPlayerControls {
    getVolume() { /* todo */ }
    setVolume(level, max) {
        mainActivity.setVolume(level, max);
    }
    getPosition(cb) {
        cb({pos: mainActivity.getPosition(),
            duration: mainActivity.getDuration()});
    }
    resume() { mainActivity.resume(); return true; }
    pause() { mainActivity.pause(); return true; }
}


class InPagePlayerControls {
    getVolume() { /* not implemented */ }
    setVolume() { /* not implemented */ }
    getStatus(cb) {
        var a = $('audio')[0], track = $('audio').data('track')
        this.getPosition(function(pos) {
            cb({position: pos, playing: a && !a.paused, track: track});
        });
    }
    getPosition(cb) {
        var a = $('audio')[0];
        cb(a ? {pos: a.currentTime * 1000, duration: a.duration * 1000}
             : {pos: 0, duration: 0});
    }
    seek(pos) {
        var a = $('audio')[0];
        if (a) a.currentTime = pos / 1000;
    }
    resume() {
        var a = $('audio')[0];
        if (a) a.play();
        return !!a;
    }
    pause() {
        var a = $('audio')[0];
        if (a) a.pause();
        return !!a;
    }
}

var controls;

if (typeof mainActivity !== 'undefined') {       /* In Android WebView */
    controls = new AndroidAppPlayerControls();
}
else if (typeof ClientPlayerControls !== 'undefined') {  /* In client browser */
    controls = new ClientPlayerControls();
}
else {                                     /* In NWjs standalone app */
    controls = new InPagePlayerControls();
}