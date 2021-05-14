declare const yapi: any;


class TrackSplit {
    url: string // Media URL
    info: any
    ti: TrackSplitInfo

    constructor(url: string | {url: string}, info: any) {
        this.url = typeof url === 'string' ? url : url.url;
        this.info = info;
        this.ti = new TrackSplitInfo(info);
    }

    async fetchTracks() {
        var l = await this.ti.fetchTrackInfo();
        return l.map(ti => this.exportTrack(ti));
    }

    exportTrack(trackInfo: TrackInfo) {
        var from = this.ti._timestampSeconds(trackInfo.from),
            to = trackInfo.to ? this.ti._timestampSeconds(trackInfo.to) : '',
            duration = (typeof to === 'number') ? this._durationFrom(to - from) : undefined;
        return {id: `${this.ti._id()}@${from}`, kind: Playlist.KIND.DIRECT,
                snippet: trackInfo, contentDetails: {duration},
                uri: `${this.url}#t=${from},${to}`};
    }

    static async fromTrack(item: Playlist.Item) {
        return TrackSplit.fromYouTubeId(YoutubeItem.id(item), item);
    }

    static async fromYouTubeId(id: string, info: any = {id}) {
        return new TrackSplit(
            await playerCore.getWatchUrl(id, '', TrackSplit.PREFERRED_FORMATS),
            info);
    }

    _durationFrom(sec: number) {
        var s = sec % 60, min = Math.floor(sec / 60),
            m = min % 60, h = Math.floor(min / 60);
        return h > 0 ? `PT${h}H${m}M${s}S` : `PT${m}M${s}S`;
    }

    static PREFERRED_FORMATS = undefined;
}

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


export  { TrackSplit, TrackSplitInfo }
