'use strict';

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
    props: ['show'],
    template: `
        <button name="show-playlist" @click="toggle"
            :class="{on: show.playlist}">[playlist]</button>
    `,
    methods: {
        toggle() {
            this.show.playlist = !this.show.playlist;
        }
    }
});


Vue.component('control-panel', {
    props: ['show'],
    data: function() { return {expand: false, status: {}, monitorInterval: 500}; },
    template: `
        <div class="control-panel" :class="{expand}">
            <div class="controls">
                <playlist-button ref="playlist" :show="show"/>
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
    getStatus(cb) {
        this.getPosition(function(pos) {
            cb({position: pos, playing: !!pos.duration /** @todo */});
        });
    }
    getPosition(cb) {
        cb({pos: mainActivity.getPosition(),
            duration: mainActivity.getDuration()});
    }
    seek(pos) {
        mainActivity.setPosition(pos);
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