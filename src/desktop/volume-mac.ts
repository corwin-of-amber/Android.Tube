import _ from 'lodash';
import * as pty from 'node-pty'; /** @kremlin.native */
import { Future } from '../infra/future';
import { VolumeControl } from '../controls';


/**
 * Controls volume with AppleScript (osascript)
 */
class VolumeControlAS extends VolumeControl {
    osascript: pty.IPty
    pending?: FutureSeq<string>

    nreq = 0
    nresp = 0

    constructor() {
        super();
        this.osascript = pty.spawn('osascript', ['-l', 'JavaScript', '-i'], {cols: 999});
        this.osascript.onData(ln => this.handle(ln));
        
        this.jxa(VolumeControlAS.PREAMBLE);

        window.addEventListener('beforeunload', () => this.osascript.kill());
    }

    async get() {
        return +(await this.jxa('app.getVolumeSettings()["outputVolume"]'));
    }

    async set(vol: number, max?: number) {
        if (max) vol = vol * this.max / max;
        await this.jxa(`app.setVolume(null, { outputVolume: ${vol} });`);
    }

    get max() { return 100; }

    async jxa(cmd: string) {
        this.pending = new FutureSeq(this.nreq++);
        this.osascript.write(cmd + '\n');
        return this.pending.promise;
    }

    handle(ln: string) {
        let mo = ln.match(/^=> (.*)/m);
        if (mo) {
            let seq = this.nresp++;
            this.pending?.resolveSeq(mo[1], seq);
        }
    }

    static PREAMBLE = `var app = Application.currentApplication(); ` +
                      `app.includeStandardAdditions = true;`;
}


class FutureSeq<A> extends Future<A> {
    seq: number

    constructor(seq: number) {
        super();
        this.seq = seq;
    }

    resolveSeq(val: A, seq: number) {
        if (seq === this.seq) this.resolve(val);
    }
}


export { VolumeControlAS }