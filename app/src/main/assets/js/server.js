


function jsonCmd(msg) {
    var cmd = JSON.parse(msg);
    switch (cmd.type) {
    case 'search':   return yapi.search(cmd.text);
    case 'details':  return yapi.details(cmd.videoId);
    case 'watch':    return getStream(cmd.youtubeUrl);
    }
}


const fs = require('fs'), http = require('http'), concat = require('concat-stream');

class Server {
    constructor(port=8005) {
        this.port = port;

        this.server = http.createServer();
        this.server.listen(this.port);

        this.server.on('request', (request, response) => this.handle(request, response));

        window.addEventListener('unload', () => this.server.close());
    }

    handle(request, response) {
        console.log(request);
        try {
            if (request.method === 'GET' && request.url === '/') {
                fs.createReadStream('app/src/main/assets/html/client.html').pipe(response);
            }
            else if (request.method === 'GET' && 
                ['/node_modules/', '/app/'].some(p => request.url.startsWith(p))) {
                fs.createReadStream(request.url.substring(1)).pipe(response);
            }
            else if (request.method === 'POST') {
                request.pipe(concat(async (msg) => {
                    var c = await jsonCmd(msg);
                    response.write(JSON.stringify(c));
                    response.end();
                }));
            }
            else {
                response.write(JSON.stringify({error: "bad request"}));
                response.end();
            }
        }
        catch (e) {
            console.error(e);
            response.write(JSON.stringify({error: e}));
            response.end();
        }
    }
}
