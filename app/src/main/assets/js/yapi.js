'use strict';


/*
const api_key = 'AIzaSyCXd3M-Cb0KvyBMKTNS23nfaoiez6l51Go',
      api_origin = 'https://developers.google.com';

const api_key = 'AIzaSyAa8yy0GdcGPHdtD083HiGGx_S0vMPScDM',
      api_origin = 'https://explorer.apis.google.com';
*/
const api_key = 'AIzaSyCcPH7jiPoZ0zub39kkdaufXD2yNyz5r24',
      api_origin = 'corwin.amber';

const api_endpoint = 'https://content.googleapis.com/youtube/v3';

class YouTubeSearch {

    constructor() {
        this.details = memoize1(this._details);
        this.snippet = memoize1(this._snippet);
    }

    yapi(action, params) {
        var url=`${api_endpoint}/${action}?${$.param(params)}&key=${api_key}`;
        return new Promise(function(resolve, reject) {
            $.getJSON({url: url, headers: {'X-Origin': api_origin}})
            .done(function(data) { resolve(data); })
            .fail(function(jq) { reject(jq.responseJSON); });
        });
    }

    search(query) {
        var id = this.asVideoId(query);
        return id ? this.yapi('videos', {id, part: 'snippet,contentDetails'})
                  : this.yapi('search', {maxResults: 50, part: 'snippet', q: query});
    }

    page(pageToken) {
        return this.yapi('search', {maxResults: 50, part: 'snippet', pageToken: pageToken});
    }

    playlistItems(playlistId) {
        var self = this,
            props = {playlistId: playlistId, maxResults: 50, part: 'snippet'};
        return this.yapi('playlistItems', props)
            .then(function(results) {
                return new YoutubePagedResults(
                    results,
                    function(props) { return self.yapi('playlistItems', props)},
                    props);
                });
    }

    playlistItemsAll(playlistId) {
        return this.playlistItems(playlistId).then(function(paged) {
            return paged.all().then(function(results) {
                return [].concat.apply([],
                    results.map(function(r) { return r.items; }));
            });
        });
    }

    asVideoId(query) {
        if (query.match(/^[#=]/)) return query.slice(1);
        else {
            try { return ytdl.getURLVideoID(query); }
            catch (e) { return undefined; }
        }
    }

    _details(videoId) {
        return this.yapi('videos', {part: 'contentDetails', id: videoId})
            .then(this._item('contentDetails'));
    }

    _snippet(videoId) {
        return this.yapi('videos', {part: 'snippet', id: videoId})
            .then(this._item('snippet'));
    }

    _item(prop) {
        return function(res) {
            var item = res.items[0];
            return item ? res.items[0][prop] : Promise.reject(`not found: '${videoId}'`);
        }
    }
}


class YoutubePagedResults {
    constructor(current, cont, props) {
        this.current = current;
        this.cont = cont;
        this.props = props || {};
    }

    next() {
        if (this.current.nextPageToken) {
            var self = this,
                props = Object.assign({pageToken: this.current.nextPageToken}, this.props);
            return this.cont(props).then(function(result) {
                return new YoutubePagedResults(result, self.cont, self.props);
            });
        }
    }

    all() {
        var acc = [this.current], next = this.next();
        if (next)
            return next.then(function(more) {
                return more.all().then(function(rest) { return acc.concat(rest); });
            });
        else
            return Promise.resolve(acc);
    }
}


function memoize1(func) {
    var memo = {};
    return function(arg) {
        return memo[arg] || (memo[arg] = func.call(this, arg));
    };
}
