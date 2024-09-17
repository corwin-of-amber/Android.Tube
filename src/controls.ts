import _ from 'lodash';
import $ from 'jquery';


class InPagePlayerControls {

    volume: VolumeControl

    constructor(volume: VolumeControl) {
        this.volume = volume;
    }

    getVolume(cb) { /* not implemented */ }
    setVolume(level, max) { /* not implemented */ }
    getStatus(cb) {
        var a = $('audio')[0], track = $('audio').data('track')
        this.getPosition(function(pos) {
            cb({position: pos, playing: a && !a.paused, track: track});
        });
    }
    getPosition(cb) {
        var a = document.querySelector('audio');
        cb(a ? {pos: a.currentTime * 1000, duration: a.duration * 1000}
             : {pos: 0, duration: 0});
    }
    seek(pos) {
        var a = document.querySelector('audio');
        if (a) a.currentTime = pos / 1000;
    }
    resume() {
        var a = document.querySelector('audio');
        if (a) a.play();
        return !!a;
    }
    pause() {
        var a = document.querySelector('audio');
        if (a) a.pause();
        return !!a;
    }
}


abstract class VolumeControl {
    abstract get(): Promise<number>
    abstract set(level: number, max?: number): Promise<void>
    abstract get max(): number

    async delegate() {
        const max = 1000, ratio = max / this.max,
              throttledSet = _.throttle(v => this.set(v), 250);
        return {
            _level: await this.get() * ratio,
            get level() { return this._level; },
            set level(v: number) { this._level = v; throttledSet(v / ratio); },
            get max() { return max; }
        }
    }
}


export { InPagePlayerControls, VolumeControl }