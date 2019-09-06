#!/usr/bin/env node

const http = require('http');

const BASE = new URL('http://10.0.0.6:2224');

function play(url) {
    post({type: 'watch', url: encodeURI(url)});
}

function stop() {
    post({type: 'stop'});
}

function post(data) {
    if (typeof data !== 'string') data = JSON.stringify(data);

    var req = http.request({
        hostname: BASE.hostname, port: Number(BASE.port || 80),
        path: '/',
        method: 'POST',
        headers: {
            'Content-Type': 'text/json',
            'Content-Length': data.length
        }
    }, (res) => {
        res.pipe(process.stdout);
    });

    req.on('error', (e) => {
        console.error(`problem with request '${data}': ${e.message}`);
    });
    
    req.write(data);
    req.end();
}


var opts = require('commander'), done;

opts.command('play <url>')
    .action((url) => { console.log({url}); play(url); done = true; });

opts.parse(process.argv);

if (!done)
    console.log(opts);
