#!/usr/bin/env node

const http = require('http'),
      fs = require('fs');

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

function playlistPut(filename) {
    var content = fs.readFileSync(filename),
        id = JSON.parse(content).id;
    put(`/playlists/${id}`, content);
}

function upload(filename, thenPlay) {
    if (filename.endsWith('.json')) playlistPut(filename);
    else uploadFile(filename, thenPlay);
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

async function status() {
    var json;
    try {
        json = await get('/status', false);
    }
    catch (e) { return; }

    console.log(JSON.parse(json));
}

function waitToFinishPlaying() {
    return new Promise((resolve, reject) => {
        var iv = setInterval(async () => {
            try {
                var st = JSON.parse(await get('/status', false)),
                    p = st.position,
                    msg = `${st.playing ? '▶︎' : ' '} ${p && p.pos || '??'}/${p && p.duration || '??'}`;
                
                process.stderr.write(`\r${msg}       \r${msg}`, );
                if (!p) reject()
                else if (!st.playing && st.position.pos >= st.position.duration) {
                    clearInterval(iv); resolve();
                }
            }
            catch (e) { console.log(e); }
        }, 1000);
    });
}

function fetch(url) {
    get(`/fetch?${url}`);
}

function post(path, data, method='POST') {
    if (typeof data === 'object' && !(data instanceof Buffer))
        data = JSON.stringify(data);
    if (typeof data === 'string')
        data = Buffer.from(data);  // so that data.length is in bytes

    var req = http.request({
        hostname: BASE.hostname, port: Number(BASE.port || 80),
        path: path,
        method: method,
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

function put(path, data, method='PUT') {
    return post(path, data, method);
}

function get(path, echo=true) {
    var buf = '';

    return new Promise((resolve, reject) => {
        var req = http.request({
            hostname: BASE.hostname, port: Number(BASE.port || 80),
            path: path,
            method: path.includes('?') ? 'POST' : 'GET'
        }, (res) => {
            res.on('data', d => buf += d);
            res.on('end', () => { if (echo) console.log(buf); resolve(buf); });
        });

        req.on('error', (e) => {
            console.error(`problem with request '${path}': ${e.message}`);
            if (!echo) reject(e);
        });

        req.end();
    });
}

function uploadFile(filename, thenPlay) {   // via WebSocket
    const WebSocket = require('ws');

    var ws = new WebSocket(new URL(`cache/c`, BASE).href),
        done = false;
    ws.once('open', () => {
        console.log('open', ws.url);
        ws.send(fs.readFileSync(filename));
        var iv = setInterval(function() {
            console.log(ws.bufferedAmount);
            if (ws.bufferedAmount === 0) {
                clearInterval(iv); ws.close(); done = true;
            }
        }, 500);
    });
    ws.once('close', () => {
        console.log('close');
        if (done && thenPlay) play('file:///music/c');
    });
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
        var urls = {}; //require('./data/urls.json');
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
    .action(() => { pause(); done = true; });
opts.command('pause')
    .action(() => { pause(); done = true; });
opts.command('resume')
    .action(() => { resume(); done = true; });
opts.command('status')
    .action(() => { status(); done = true; });
opts.command('search <text>')
    .action((text) => { search(text); done = true; });
opts.command('vol [level] [max]')
    .action((level, max) => { vol(level && Number(level), max && Number(max)); done = true; });
opts.command('master-vol [level] [max]')
    .action((level, max) => { mvol(level && Number(level), max && Number(max)); done = true; });
opts.command('pos [seek-to]')
    .action((seek) => { pos(seek); done = true; });
opts.command('wait')
    .action(() => { waitToFinishPlaying(); done = true; });
opts.command('upload -p <filename>')
    .option('-p,--play', 'start playing after upload')
    .action((filename, o) => { upload(filename, o.play); console.log(o.play); done = true; });

opts.command('fetch <url>')
    .action((url) => { fetch(url); done = true; });

opts.parse(process.argv);

if (!done)
    console.log(opts);
