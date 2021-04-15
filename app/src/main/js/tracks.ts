declare const yapi: any;
declare const YoutubeItem: any;


/**
 * Extracts sub-track information that is stored in YouTube's description
 * field as timestamps HH:MM:SS.
 * 
 * Assumes that each track is exactly one line in the description.
 * Track title can occur before or after the timestamp.
 */
class TrackSplitInfo {
    info: any

    static readonly TIMESTAMP_RE = /\b(\d+):(\d\d)(?::(\d\d))?\b/;

    constructor(info: any) {
        this.info = info
    }

    async fetchTracks(mediaUri: string) {
        var l = await this.fetchTrackInfo();
        return l.map(ti => this.exportTrack(ti, mediaUri));
    }

    async fetchTrackInfo() {
        var d = await this.fetchDescription();
        return d ? [...this.parseTrackInfo(d)] : []
    }

    *parseTrackInfo(text: string) {
        var cur: TrackInfo = undefined;
        for (let ln of text.split('\n')) {
            var mo = ln.match(TrackSplitInfo.TIMESTAMP_RE);
            if (mo) {
                var ts = this._timestampFrom(mo), ti = this._titleFrom(mo);
                if (cur) {
                    cur.to = ts; yield cur;
                }
                cur = {title: ti, from: ts};
            }
        }
        if (cur) yield cur;
    }

    exportTrack(trackInfo: TrackInfo, mediaUri: string) {
        var from = this._timestampSeconds(trackInfo.from),
            to = trackInfo.to ? this._timestampSeconds(trackInfo.to) : '';
        return {id: `${this._id()}@${from}`, kind: 3,
            snippet: trackInfo, uri: `${mediaUri}#t=${from},${to}`};
    }

    _timestampFrom(mo: RegExpMatchArray) {
        return mo[3] ? {h: +mo[1], m: +mo[2], s: +mo[3]}
                     : {h: 0,      m: +mo[1], s: +mo[2]};
    }

    _timestampSeconds(ts: TimeStamp) {
        return (ts.h * 60 + ts.m) * 60 + ts.s
    }

    _titleFrom(mo: RegExpMatchArray) {
        return (mo.input.slice(0, mo.index) + 
                mo.input.slice(mo.index + mo[0].length)).trim();
    }

    async fetchDescription() {
        var snip = await yapi.snippet(this._id());
        return snip?.description;
    }

    _id() {
        return YoutubeItem.id(this.info); 
    }
}

type TimeStamp = {h: number, m: number, s: number};
type TrackInfo = {title: string, from: TimeStamp, to?: TimeStamp};


export  { TrackSplitInfo }
