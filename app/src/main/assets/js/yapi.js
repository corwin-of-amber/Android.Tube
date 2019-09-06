'use strict';


const key = 'AIzaSyAa8yy0GdcGPHdtD083HiGGx_S0vMPScDM',
      api_endpoint = 'https://content.googleapis.com/youtube/v3',
      api_origin = 'https://explorer.apis.google.com';

function yapi(action, params) {
    var url=`${api_endpoint}/${action}?${$.param(params)}&key=${key}`;
    return new Promise(function(resolve, reject) {
        $.getJSON({url: url, headers: {'X-Origin': api_origin}})
        .done(function(data) { resolve(data); })
        .fail(function(jq) { reject(jq.responseJSON); });
    });
}

yapi.search = function(query) {
    return this('search', {maxResults: 50, part: 'snippet', q: query});
}

yapi.page = function(pageToken) {
    return this('search', {maxResults: 50, part: 'snippet', pageToken: pageToken});
}

yapi.details = memoize1(function(videoId) {
    return this('videos', {part: 'contentDetails', id: videoId})
        .then(function(res) {
            var item = res.items[0];
            return item ? res.items[0].contentDetails : Promise.reject(`not found: '${videoId}'`);
        });
});


function memoize1(func) {
    var memo = {};
    return function(arg) {
        return memo[arg] || (memo[arg] = func.call(this, arg));
    };
}
