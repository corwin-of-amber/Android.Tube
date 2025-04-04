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
        if (track.contentDetails.duration)
            track.duration = YoutubeItem.parseTimeStamp(track.contentDetails.duration);
        /** @todo parse duration */
        return track;
    }
}

namespace Track {
    export enum Kind {
        LOCAL,
        DIRECT,
        YOUTUBE
    }
}


export { AppState, Track }