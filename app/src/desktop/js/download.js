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
    }

    async do() {
        var tmpfile = this._mktemp(`${this._id()}.dl.tmp`);
        await this._fetch(tmpfile);
        var outfile = this._mktemp(this._filename());
        this.fixContainer(tmpfile, outfile, this.metadata).then(() => {
            try { fs.unlinkSync(tmpfile); } catch (e) { console.warn(e); }
        });
        this.outfile = outfile;
        return outfile;
    }

    async _fetch(outfile) {
        var abuf = await (await fetch(this.url)).arrayBuffer();
        fs.writeFileSync(outfile, new Uint8Array(abuf));
    }

    fixContainer(infile, outfile, metadata={}) {
        var id = this._id();
        return new Promise((resolve, reject) =>
            ffmpeg(infile).audioCodec('copy')
            .outputOption(...this._metadataFlags(metadata))
            .on('error', err => { console.error(`[download] ${id}`, err); reject(err); })
            .on('end', () => { console.log(`[download] ${id} converted.`); resolve(); })
            .saveToFile(outfile));
    }

    static async fromTrack(item, metadata = {}) {
        return new AudioDownload(await playerCore.getWatchUrl(item.id),
                                 item, metadata);
    }

    static async do(items, metadata = {}) {
        if (!Array.isArray(items)) items = [items];
        var trackMetadata = {...metadata, track: metadata.track || 1};
        for (let item of items) {
            await (await AudioDownload.fromTrack(item, trackMetadata)).do();
            trackMetadata.track++;
        }
    }

    _mktemp(filename) {
        mkdirp.sync(AudioDownload.TEMPDIR);
        return `${AudioDownload.TEMPDIR}/${filename}`;
    }

    _id() {
        var id, t;
        if (this.info) {
            if (id = this.info.id) ;
            else if (this.info.snippet) {
                if ((t = this.info.snippet.resourceId) &&
                    (id = t.videoId)) ;
                else /** @todo */ ;
            }
        }
        return id || '@todo';
    }

    _filename() {
        var title;
        if (this.info && this.info.snippet)
            title = this.info.snippet.title;
        else
            title = this._id();
        title = title.replace(/[/]/g, ':');  // sanitize
        return `${title}.m4a`;  /** @todo choose extension */
    }

    _metadataFlags(metadata) {
        const mdflag = '-metadata';
        return [].concat(...[...Object.entries(metadata)]
                             .map(([k,v]) => [mdflag, `${k}=${v}`]));
    }

    static TEMPDIR = '/tmp/Android.Tube';
}