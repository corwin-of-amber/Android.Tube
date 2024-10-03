import _ from 'lodash';
import $ from 'jquery';
import { EventEmitter } from 'events';


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


class SleepTimer extends EventEmitter {
    mins: number
    defaultMins: number
    startTime: Date
    startMins: number
    _ivals: NodeJS.Timeout[] = []

    constructor(mins: number) {
        super();
        this.mins = this.defaultMins = mins;
        this.on('fired', () => this.sleep());
    }

    start() {
        this.startTime = new Date();
        this.startMins = this.mins;
        if (this._ivals.length === 0)
            this._ivals.push(setInterval(() => this._monitor(), 2000));
    }

    stop() {
        for (let ival of this._ivals)
            clearInterval(ival);
        this._ivals = [];
    }

    get isRunning() { return this._ivals.length > 0; }

    _monitor() {
        let secs = Math.round((+new Date() - +this.startTime) / 1000),
            mins = secs; //Math.floor(secs / 60);
        console.log(secs, mins);
        this.mins = Math.max(0, this.startMins - mins);
        if (this.mins === 0)
            this._reached();
    }

    _reached() {
        this.stop();
        this.emit('fired');
        setTimeout(() => this.reset(), 6000);
    }

    reset(mins?: number) {
        let running = this.isRunning;
        this.stop();
        if (mins) this.defaultMins = mins;
        this.mins = this.defaultMins;
        if (running) this.start();
    }

    sleep() {
        // macos
        require('child_process').execSync('pmset sleepnow')
    }
}


export { InPagePlayerControls, VolumeControl, SleepTimer }