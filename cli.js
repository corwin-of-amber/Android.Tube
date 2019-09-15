#!/usr/bin/env node

const http = require('http');

const BASE = new URL('http://10.0.0.11:2224');

function play(url) {
    post({type: 'watch', url: encodeURI(url)});
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


var opts = require('commander'), done;

opts.command('play <url>')
    .action((url) => { play(url); done = true; });
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

opts.parse(process.argv);

if (!done)
    console.log(opts);
