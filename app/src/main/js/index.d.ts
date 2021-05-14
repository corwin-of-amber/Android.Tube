declare var playerCore: any;

declare class YoutubeItem {
    static id(item: Playlist.Item): string
    static title(item: Playlist.Item): string
    static mediaUriOrId(item: Playlist.Item): string
}

declare namespace Playlist {
    enum KIND { DIRECT, YOUTUBE, LOCAL }

    type Item = unknown
}