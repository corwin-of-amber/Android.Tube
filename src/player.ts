
class YoutubeItem {
    static id(item) {
        var id = item.id || item.snippet && item.snippet.resourceId;
        return id.videoId || id;
    }
    static kind(item) {
        var id = item.id || item.snippet && item.snippet.resourceId;
        return (id && id.kind) || item.kind  /** makes you wish you had `?.` */
    }
    static title(item) {
        return item.snippet && item.snippet.title;
    }
    static mediaUriOrId(item) {
        return item.uri || YoutubeItem.id(item);
    }
    static webUrl(item) {
        return item.uri || `https://youtube.com/watch?v=${YoutubeItem.id(item)}`;
    }
}


export { YoutubeItem }