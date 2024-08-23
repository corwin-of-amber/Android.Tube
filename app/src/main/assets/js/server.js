
const fs = require('fs'), http = require('http'), concat = require('concat-stream');



/**
 * A JS clone of the server from MainActivity (for testing).
 */
class Server {
    actionOpts = {scope: 'local', autoplay: true}

    constructor(port=2224) {
        this.port = port;

        this.server = http.createServer();
        this.server.listen(this.port);

        this.server.on('request', (request, response) => this.handle(request, response));

        this.controls = new InPagePlayerControls();

        window.addEventListener('unload', () => this.server.close());
    }

    handle(request, response) {
        console.log('%c[server] %s %s', 'color:blue', request.method, request.url);
        var serveStatic = (filename) => {
            console.log(filename);
            fs.createReadStream(filename).on('error', console.error)
            .pipe(response);
        };
        try {
            var [path, q] = request.url.split('?')
            if (request.method === 'GET' && path === '/') {
                serveStatic('app/src/main/assets/html/app.html');
            }
            else if (request.method === 'GET' && path === '/js/yapi.js') {
                serveStatic('app/src/main/assets/js/client.js');
            }
            else if (request.method === 'GET' && 
                ['/js/', '/css/'].some(p => request.url.startsWith(p))) {
                serveStatic('app/src/main/assets' + request.url);
            }
            else if (path === '/status') { this.controls.getStatus(function (s) { response.write(JSON.stringify(s)); response.end(); }); }
            else if (path === '/resume') { this.controls.resume(); response.end(); }
            else if (path === '/pause')  { this.controls.pause(); response.end(); }
            else if (path === '/pos')    { this.controls.seek(+q); response.end(); }
            else if (path === '/vol')    { response.end(); }
            else if (request.method === 'POST') {
                request.pipe(concat(async (msg) => {
                    let json = JSON.parse(msg);
                    console.log('%c[server] %o', 'color: blue', json);
                    var c = await action(json, this.actionOpts);
                    response.write(c ? JSON.stringify(c) : "ok");
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
