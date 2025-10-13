
/**
 * Manages an interval with easy start/stop, pausing when the document is
 * not visible to save resources.
 */
class Polling {
    op: () => void
    _every: number
    active: boolean = false
    mon?: NodeJS.Timeout

    _listener?: () => void

    constructor(op: () => void, every: number, options: {background?: boolean} = {}) {
        this.op = op;
        this._every = every;

        if (!options.background) {
            this._listener = () => this._vis();
            document.addEventListener('visibilitychange', this._listener);
        }
    }

    destroy() {
        this.stop();
        if (this._listener)
            document.removeEventListener('visibilitychange', this._listener);
    }

    get every() { return this._every }

    set every(ms: number) {
        if (this._every !== ms) {
            this.pause();
            this._every = ms;
            this.resume(false);
        }
    }

    start(now: boolean = true) {
        if (this.mon === undefined) {
            this.mon = setInterval(() => this._poll(), this.every);
            if (now) this._poll();
        }
        this.active = true;
        return this;
    }

    stop() {
        this.pause();
        this.active = false;
    }

    now() {
        if (this.active && !(this._listener && document.hidden)) {
            this.pause();
            this.resume(true);  // to reset the interval
        }
        else
            this._poll();
        return this;
    }

    defer() {
        if (this.active) {
            this.pause();
            this.resume(false);  // to reset the interval
        }
    }

    pause() {
        if (this.mon !== undefined) {
            clearInterval(this.mon)
            this.mon = undefined;
        }
    }

    resume(now?: boolean) {
        this.start(now);  // nothing special here
    }

    _poll() {
        this.op();  // nothing special here too
    }

    _vis() {
        if (document.hidden) this.pause();
        else if (this.active) this.resume();
    }
}


export { Polling }