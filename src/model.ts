import * as musicmd from 'music-metadata';
import { YoutubeItem } from "./player"


class AppState {
    search: {
        query: string
        results: Track[]
    } 
      = {query: '', results: []}

    volume: {level: number, max: number} = {level: 500, max: 1000}
    sleep: {mins: number, isRunning: boolean} = {mins: 0, isRunning: false}
}


class Track {
    id: string
    kind: Track.Kind
    title: string
    url?: string
    uri?: URL  /** @todo combine `url` and `uri`? */

    snippet?: any
    contentDetails?: any
    duration: number[] = null

    constructor(id: string, kind: Track.Kind, title: string) {
        this.id = id;
        this.kind = kind;
        this.title = title;
    }

    static fromYoutubeSearchResult(item: any): Track {
        let track = new Track(YoutubeItem.id(item), Track.Kind.YOUTUBE, item.snippet.title);
        track.snippet = item.snippet;
        track.contentDetails = item.contentDetails;
        if (track.contentDetails?.duration)
            track.duration = YoutubeItem.parseTimeStamp(track.contentDetails.duration);
        /** @todo parse duration */
        return track;
    }

    static fromFile(file: string | {name: string, path: string}): Track {
        if (typeof file === 'string')
            file = {name: file.match(/[^/]*$/)?.[0] || '???', path: file};
        /** @todo use URL.createObjectURL for blobs with no `file://` access */
        return {id: sillyHash(file.path), kind: Track.Kind.LOCAL,
            title: file.name,
            duration: null,
            snippet: {title: file.name}, uri: pathToFileURI(file.path)};
    }

    static async snippetFromBlob(blob: Blob) {
        let metadata = await musicmd.parseBlob(blob);
        // -- more stuff here
        return {...metadata.common, duration: metadata.format.duration};
    }

    static async fromFileEx(file: File) {
        let track = Track.fromFile(file as any /* should have "path" */),
            snippet = await Track.snippetFromBlob(file);
        if (snippet) {
            track.snippet = snippet;
            if (snippet.title)
                track.title = snippet.title;
            if (typeof snippet.duration === 'number')
                track.duration = Track.hmsFromSecs(snippet.duration)
        }
        return track;
    }

    static hmsFromSecs(secs: number) {
        secs = Math.floor(secs);
        let mins = Math.floor(secs / 60);
        return [Math.floor(mins / 60) || undefined, mins % 60, secs % 60];
    }

}

namespace Track {
    export enum Kind {
        LOCAL,
        DIRECT,
        YOUTUBE
    }
}


function sillyHash(s: string) {
    return s.split('').reduce((hash, char) => {
        return char.charCodeAt(0) + (hash << 6) + (hash << 16) - hash;
    }, 0).toString(36);
}

function pathToFileURI(fn: string) {
    return new URL(
        fn.split('/').map(encodeURIComponent).filter(x => x).join('/'),
        new URL('file:///')
    );
}


export { AppState, Track }