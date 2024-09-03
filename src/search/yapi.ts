
/* required format of yapi-keys.js:
const api_key = 'AIzaSyCXd3M-Cb0KvyBMKTNS23nfaoiez6l51Go',
      api_origin = 'https://developers.google.com';
*/

import $ from 'jquery';
import { api_key, api_origin } from './yapi-keys';
import { Track } from '../model';

const api_endpoint = 'https://content.googleapis.com/youtube/v3';


class YouTubeSearch {

    details = memoize1(this._details)
    snippet = memoize1(this._snippet);

    yapi(action, params): Promise<any> {
        var url=`${api_endpoint}/${action}?${$.param(params)}&key=${api_key}`;
        return new Promise(function(resolve, reject) {
            $.getJSON({url: url, headers: {'X-Origin': api_origin}})
            .done(function(data) { resolve(data); })
            .fail(function(jq) { reject(jq.responseJSON); });
        });
    }

    search(query) {
        var id = this.asVideoId(query),
            resp = id ? this.yapi('videos', {id, part: 'snippet,contentDetails'})
                      : this.yapi('search', {maxResults: 50, part: 'snippet', q: query});

        return resp.then(({items}) => ({items: this.postprocessItems(items as any[])}));
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
            // @ts-ignore
            try { return ytdl.getURLVideoID(query); }
            catch (e) { return undefined; }
        }
    }

    postprocessItems(items: any[]): Track[] {
        return items.flatMap(item =>
            item.id.kind === 'youtube#video' ? Track.fromYoutubeSearchResult(item) : []);
    }

    _details(videoId) {
        return this.yapi('videos', {part: 'contentDetails', id: videoId})
            .then(this._item(videoId, 'contentDetails'));
    }

    _snippet(videoId) {
        return this.yapi('videos', {part: 'snippet', id: videoId})
            .then(this._item(videoId, 'snippet'));
    }

    _item(videoId, prop) {
        return function(res) {
            var item = res.items[0];
            return item ? res.items[0][prop] : Promise.reject(`not found: '${videoId}'`);
        }
    }
}


class YoutubePagedResults {
    current: any
    cont: any
    props: any

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


function memoize1<X extends string, Y>(func: (x: X) => Y): (x: X) => Y {
    var memo: {[x: string]: Y} = {};
    return function(arg: X) {
        return memo[arg] || (memo[arg] = func.call(this, arg));
    };
}


export { YouTubeSearch, YoutubePagedResults }