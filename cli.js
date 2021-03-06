#!/usr/bin/env node

const http = require('http'),
      fs = require('fs');

var BASE = new URL('http://10.0.0.11:2224');

function play(urls, enqueue, uploadPrefix) {
    (urls.length == 1 && !enqueue) ? playSingle(urls[0], uploadPrefix)
                                   : playMultiple(urls, uploadPrefix);
}

function playSingle(url, uploadFn) {
    if (isFile(url))
        uploadFile(url, true, uploadFn);
    else
        post('/', {type: 'watch', url: toURI(url)});
}

async function playMultiple(urls, prefix="c") {
    async function* intoTracks() {
        for (let [i, url] of Object.entries(urls)) {
            var id = `${prefix}${i}`;
            if (isFile(url)) url = await uploadFile(url, false, id);
            yield {id, kind: 2, uri: toURI(url)};
        }
    }
    var tracks = await collect(intoTracks());
    post('/playlist?enqueue', {tracks});
}

function isFile(url) {
    return url.match(/^[./]/) || fs.existsSync(url);
}

async function collect(g) {
    var out = [];
    for await (let e of g) out.push(e);
    return out;
}

async function playlist(filename_or_plid) {
    if (isYoutubePlaylist(filename_or_plid))
        console.log((await playlistFromYoutube(filename_or_plid)).join(' '));
    else
        post('/playlist', {tracks: readTracks(filename_or_plid)});
}

function playlistPut(filename) {
    var content = fs.readFileSync(filename),
        id = JSON.parse(content).id;
    put(`/playlists/${id}`, content);
}

function isYoutubePlaylist(url) {
    try {
        const ytpl = require('ytpl');
        return ytpl.validateID(url);
    }
    catch { return false; }
}

async function playlistFromYoutube(plid) {
    const ytpl = require('ytpl'),
          pl = await ytpl(plid);
    for (let track of pl.items) {
        console.log(`${track.id} | ${`[${track.author && track.author.name || '??'}] ${track.title}`
                                     .padEnd(50)}    ${track.duration}`);
    }
    return pl.items.map(tr => tr.id);
}

function upload(filename, thenPlay, name) {
    if (filename.endsWith('.json')) playlistPut(filename);
    else uploadFile(filename, thenPlay, name);
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
                    msg = `${st.playing ? '▶︎' : ' '} ${p && p.pos || '??'}/${p && p.duration || '??'}  ${st.track || ''}`;
                
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

function uploadFile(filename, thenPlay, name='c') {   // via WebSocket
    const WebSocket = require('ws');

    var ws = new WebSocket(new URL(`cache/${name}`, BASE).href),
        done = false;
    ws.once('open', () => {
        console.log('open', ws.url);
        fs.createReadStream(filename).on('data', chunk => ws.send(chunk));
        var iv = setInterval(function() {
            console.log(ws.bufferedAmount);
            if (ws.bufferedAmount === 0) {
                clearInterval(iv); ws.close(); done = true;
            }
        }, 500);
    });
    var p = new Promise((resolve, reject) => {
        ws.once('close', () => {
            console.log('close', done);
            if (done) resolve(`file:///music/${name}`);
            else console.log('upload failed.');
        });
    });
    return thenPlay ? p.then(playSingle) : p;
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

if (process.env.TUBE_SERVER) {
    BASE = new URL(`http://${process.env.TUBE_SERVER}:2224`);
}

var opts = require('commander'), done;

opts.option('-s,--server <url>', 'server url')
    .on('option:server', x => BASE = new URL(`http://${x}:2224`));

opts.command('play <urls...>')
    .option('-q,--enqueue', 'enqueue files to play at the end of the current playlist')
    .option('-a,--as <prefix>', 'filename prefix for uploaded files')
    .action((urls, o) => { play(urls, o.enqueue, o.as); done = true; });
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
opts.command('upload -p -a <filename>')
    .option('-p,--play', 'start playing after upload')
    .option('-a,--as <filename>', 'remote filename (default: c)')
    .action((filename, o) => { upload(filename, o.play, o.as); done = true; });

opts.command('fetch <url>')
    .action((url) => { fetch(url); done = true; });

opts.parse(process.argv);

if (!done)
    console.log(opts);
