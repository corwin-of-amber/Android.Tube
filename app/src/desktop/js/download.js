const /* fs = require('fs'), */ /** @oops in server.js */
      mkdirp = require('mkdirp'),
      ffmpeg = require('fluent-ffmpeg');


class AudioDownload {
    constructor(url, info, metadata = {}) {
        if (url.url)   // format object from ytdl
            this.url = url.url;
        else
            this.url = url;
        this.info = info;
        this.metadata = metadata;
        this.interval = this._extractInterval(this.url);
    }

    async do(progress = () => {}) {
        var outfile = this._filename(), id = this._id();
        console.log(`[download] ${id} ${outfile}`);
        progress({id}, outfile);
        if (this.interval) {    /* intervals must use `ffmpeg`'s fetch */
            await this._fetchMetadata();
            outfile = this._mktemp(outfile);
            await this.fixContainer(this.url, outfile, this.metadata);
        }
        else {   /* fetch using browser API because it's faster */
            var tmpfile = this._mktemp(`${this._id()}.dl.tmp`);
            try {
                await Promise.all([
                    this._fetch(tmpfile, progress),
                    this._fetchMetadata()
                ]);
                outfile = this._mktemp(outfile);
                await this.fixContainer(tmpfile, outfile, this.metadata);
            }
            finally {
                try { fs.unlinkSync(tmpfile); } catch (e) { console.warn(e); }
            }
        }
        this.outfile = outfile;
        return outfile;
    }

    async _fetch(outfile, progress = () => {}) {
        var abuf = await fetchWithProgress(this.url, progress);
        fs.writeFileSync(outfile, new Uint8Array(abuf));
    }

    async _fetchMetadata() {
        var id = this._id();
        this.metadata = {...this.metadata};
        if (id) {
            this.metadata['comment'] = JSON.stringify({youtube_id: id});
            if (this.metadata['description'] === true) {
                var snip = await yapi.snippet(this._id());
                if (snip.description)
                    this.metadata['description'] = snip.description;
            }
        }
        if (!this.metadata['title']) {
            var title = this._title();
            if (title) {
                this.metadata['title'] = title;
            }
        }
    }

    fixContainer(infile, outfile, metadata={}) {
        var id = this._id();
        return new Promise((resolve, reject) =>
            ffmpeg(infile).audioCodec('copy')
            .inputOptions(this._intervalFlags(this.interval))
            .outputOption(...this._metadataFlags(metadata)) /* splat needed because flags may contain spaces etc. (fluent-ffmpeg weirdness http://fluent-ffmpeg.github.io/index.html#output-options) */
            .on('error', (err, stdout, stderr) => { console.error(`[download] ${id}`, err, stdout, stderr); reject(err); })
            .on('end', () => { console.log(`[download] ${id} converted.`); resolve(); })
            .saveToFile(outfile));
    }

    static async fromTrack(item, metadata = {}) {
        return new AudioDownload(
            await playerCore.getWatchUrl(YoutubeItem.mediaUriOrId(item), '',
                                         AudioDownload.PREFERRED_FORMATS),
            item, metadata);
    }

    static async do(items, metadata = {}, progress = () => {}) {
        if (!Array.isArray(items)) items = [items];
        var trackMetadata = {...metadata, track: metadata.track || 1},
            report = new DownloadReport;
        for (let item of items) {
            progress({}, YoutubeItem.title(item) || YoutubeItem.id(item) || '...');
            try {
                await (await AudioDownload.fromTrack(item, trackMetadata)).do(progress);
                trackMetadata.track++;
            }
            catch (e) { report.reportSkipped(item, e); }
        }
        report.summary();
        progress(null);
        return report;
    }

    _mktemp(filename) {
        mkdirp.sync(AudioDownload.TEMPDIR);
        return `${AudioDownload.TEMPDIR}/${filename}`;
    }

    _id() {
        return YoutubeItem.id(this.info); 
    }

    _title() {
        if (this.info && this.info.snippet)
            return this._unhtml(this.info.snippet.title);    
    }

    _filename() {
        var fn = this._title() || this._id() || 'untitled';
        fn = fn.replace(/[/]/g, ':');  // sanitize
        return `${fn}.m4a`;  /** @todo choose extension */
    }

    _metadataFlags(metadata) {
        const mdflag = '-metadata';
        /** @todo values must be escaped! (why..?) */
        return [].concat(...Object.entries(metadata)
                            .map(([k,v]) => [mdflag, `${k}=${v}`]));
    }

    _intervalFlags(interval) {
        return interval ? ['-ss', interval.from,
                ...(interval.to ? ['-t', interval.to - interval.from] : [])] : [];
    }

    _extractInterval(uri) {
        var mo = typeof uri == 'string' ? uri.match(/#t=(\d+),(\d+)?/) : null;
        return mo && {from: +mo[1], to: +mo[2] || undefined};
    }

    _unhtml(html) {
        return new DOMParser().parseFromString(html, 'text/html')
                .documentElement.textContent
    }

    static TEMPDIR = '/tmp/Android.Tube';

    static PREFERRED_FORMATS = PREFERRED_FORMATS;
}

// Here comes some boilerplate
function fetchWithProgress(url, progress) {
    return new Promise((resolve, reject) => {
        var xhr = new XMLHttpRequest();
        xhr.responseType = 'arraybuffer';
        xhr.onload = () => resolve(xhr.response);
        xhr.onprogress = (evt) => progress(evt);
        xhr.onerror = () => reject(new Error("download failed"));
        xhr.open('GET', url);
        xhr.send();
    });
}

class DownloadReport {
    constructor() {
        this.skipped = [];
    }

    reportSkipped(item, error) {
        var desc = `${YoutubeItem.id(item)} ${YoutubeItem.title(item) || '(untitled)'}`;
        console.error(error); console.warn(`skipping track ${desc}`);
        this.skipped.push({item, desc, error});
    }

    summary() {
        if (this.skipped.length) {
            console.warn(`skipped ${this.skipped.length} tracks:`);
            for (let skip of this.skipped) {
                console.warn(` - ${skip.desc}`, skip);
            }
        }
    }
}