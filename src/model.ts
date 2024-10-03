

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
    duration: number[] = null

    constructor(id: string, kind: Track.Kind, title: string) {
        this.id = id;
        this.kind = kind;
        this.title = title;
    }

    static fromYoutubeSearchResult(item: any): Track {
        let track = new Track(item.id.videoId, Track.Kind.YOUTUBE, item.snippet.title);
        track.snippet = item.snippet;
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