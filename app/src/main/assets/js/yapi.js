'use strict';


const api_key = 'AIzaSyCXd3M-Cb0KvyBMKTNS23nfaoiez6l51Go',
      api_origin = 'https://developers.google.com';
/*
const api_key = 'AIzaSyAa8yy0GdcGPHdtD083HiGGx_S0vMPScDM',
      api_origin = 'https://explorer.apis.google.com';
*/
const api_endpoint = 'https://content.googleapis.com/youtube/v3';

class YouTubeSearch {

    constructor() {
        this.details = memoize1(this._details);
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
        return this.yapi('search', {maxResults: 50, part: 'snippet', q: query});
    }

    page(pageToken) {
        return this.yapi('search', {maxResults: 50, part: 'snippet', pageToken: pageToken});
    }

    _details(videoId) {
        return this.yapi('videos', {part: 'contentDetails', id: videoId})
            .then(function(res) {
                var item = res.items[0];
                return item ? res.items[0].contentDetails : Promise.reject(`not found: '${videoId}'`);
            });
    }
}

var yapi = new YouTubeSearch();


function memoize1(func) {
    var memo = {};
    return function(arg) {
        return memo[arg] || (memo[arg] = func.call(this, arg));
    };
}
