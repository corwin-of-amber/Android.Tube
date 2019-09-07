
/* yapi proxy */

function server_action(cmd, responseType='text') {
    console.log(cmd);

    if (typeof cmd === 'string') {
        return $.get({url: `/${cmd}`});
    }
        
    var url = "/";
    return new Promise(function(resolve, reject) {
        $.post({url: url, data: JSON.stringify(cmd), contentType: 'text/json', dataType: responseType})
        .done(function(data) { console.log('ok', data); resolve(data); })
        .fail(function(jq, status, err) { console.error(jq, status, err);
            reject(jq.responseJSON || jq.response);
         });
    });
}

yapi = server_action;

yapi.search = (query) => server_action({type: 'search', text: query}, responseType='json');
yapi.details = (videoId) => server_action({type: 'details', videoId}, responseType='json');

// overrides global :/
async function watch(url) {
    var status = await server_action({type: 'watch', url});
    console.log(status);
    if (status !== 'ok') throw new Error(status);
}


function play(mediaUrl) {
    $('#video-area').html(
        $('<video>').attr('controls', true)
            .append($('<source>').attr('src', mediaUrl)));
}
