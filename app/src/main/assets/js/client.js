
/* yapi proxy */

var SERVER = ""
var JSON_CT = 'text/json; charset=utf-8'

function server_action(cmd, responseType='text') {
    console.log(cmd);

    if (typeof cmd === 'string') {
        if (cmd.includes('?'))
            return $.post({url: `${SERVER}/${cmd}`});
        else
            return $.get({url: `${SERVER}/${cmd}`});
    }
        
    var url = `${SERVER}/`;
    return new Promise(function(resolve, reject) {
        $.post({url: url, data: JSON.stringify(cmd), contentType: JSON_CT, dataType: responseType})
        .done(function(data) { console.log('ok', data); resolve(data); })
        .fail(function(jq, status, err) { console.error(jq, status, err);
            reject(jq.responseJSON || jq.response);
         });
    });
}

if (typeof yapi === 'undefined') {
    yapi = server_action;

    yapi.search = (query) => server_action({type: 'search', text: query}, responseType='json');
    yapi.details = (videoId) => server_action({type: 'details', videoId}, responseType='json');
}

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
