#!/usr/bin/env node

const http = require('http');

var BASE = new URL('http://10.0.0.11:2224');

function play(...urls) {
    (urls.length == 1) ? playSingle(urls[0]) : playMultiple(urls);
}

function playSingle(url) {
    post('/', {type: 'watch', url: toURI(url)});
}

function playMultiple(urls) {
    var tracks = urls.map((url, i) => ({id: i, uri: toURI(url)}));
    post('/playlist', {tracks});
}

function playlist(filename) {
    post('/playlist', {tracks: readTracks(filename)});
}

function search(query) {
    post({type: 'search', text: query});
}

function pause() { get("/pause"); }
function resume() { get("/resume"); }
function vol(level, max=100) { 
    level ? get(`/vol?${level}/${max}`) : get("/vol"); 
}
function mvol(level, max=15) { get(`/vol?;${level}/${max}`); }
function pos(seek) {
    seek ? get(`/pos?${seek}`) : get("/pos");
}

function amplify(millibels) {
    get(`/amplify?${millibels}`);
}

function post(path, data) {
    if (typeof data !== 'string') data = JSON.stringify(data);

    var req = http.request({
        hostname: BASE.hostname, port: Number(BASE.port || 80),
        path: path,
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

function get(path) {
    var req = http.request({
        hostname: BASE.hostname, port: Number(BASE.port || 80),
        path: path,
        method: path.includes('?') ? 'POST' : 'GET'
    }, (res) => {
         res.pipe(process.stdout);
     });

    req.on('error', (e) => {
        console.error(`problem with request '${path}': ${e.message}`);
    });

    req.end();
}

function readTracks(filename) {
    const fs = require('fs');
    var lines = fs.readFileSync(filename, 'utf-8').split(/\n/)
        .filter(ln => !/^\s*$/.exec(ln));
    
    return lines.map((uri, index) => (
        {id: index, uri, kind: 2}
    ));
}

function toURI(url) {
    // if url is a filename, translate to http address using URL table
    if (!url.match(/^https?:/)) {
        var urls = require('./data/urls.json');
        for (let k in urls) {
            if (url.startsWith(k)) {
                url = urls[k] + url.slice(k.length);
                break;
            }
        }
        console.log('▶︎', url);
    }
    return encodeURI(url);
}

var opts = require('commander'), done;

opts.option('-s,--server <url>', 'server url')
    .on('option:server', x => BASE = new URL(`http://${x}:2224`));

opts.command('play <urls...>')
    .action((urls) => { play(...urls); done = true; });
opts.command('playlist <filename>')
    .action((filename) => { playlist(filename); done = true; })
opts.command('stop')
    .action((text) => { pause(); done = true; });
opts.command('pause')
    .action((text) => { pause(); done = true; });
opts.command('resume')
    .action((text) => { resume(); done = true; });
opts.command('search <text>')
    .action((text) => { search(text); done = true; });
opts.command('vol [level] [max]')
    .action((level, max) => { vol(level && Number(level), max && Number(max)); done = true; });
opts.command('master-vol [level] [max]')
    .action((level, max) => { mvol(level && Number(level), max && Number(max)); done = true; });
opts.command('pos [seek-to]')
    .action((seek) => { pos(seek); done = true; });
opts.command('amplify <gain>')
    .action((gain) => { amplify(gain); done = true; });

opts.parse(process.argv);

if (!done)
    console.log(opts);
