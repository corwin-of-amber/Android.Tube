
/**
 * Manages an interval with easy start/stop, pausing when the document is
 * not visible to save resources.
 */
class Polling {
    op: () => void
    _every: number
    active: boolean = false
    mon: NodeJS.Timeout

    _listener: () => void

    constructor(op: () => void, every: number) {
        this.op = op;
        this._every = every;

        this._listener = () => this._vis();
        document.addEventListener('visibilitychange', this._listener);
    }

    destroy() {
        document.removeEventListener('visibilitychange', this._listener);
    }

    get every() { return this._every }

    set every(ms: number) {
        if (this._every !== ms) {
            this.pause();
            this._every = ms;
            this.resume();
        }
    }

    start() {
        if (this.mon === undefined) {
            this.mon = setInterval(() => this._poll(), this.every);
            this._poll();
        }
        this.active = true;
    }

    stop() {
        this.pause();
        this.active = false;
    }

    pause() {
        if (this.mon !== undefined) {
            clearInterval(this.mon)
            this.mon = undefined;
        }
    }

    resume() {
        this.start();  // nothing special here
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