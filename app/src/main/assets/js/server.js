
const fs = require('fs'), http = require('http'), concat = require('concat-stream');



/**
 * A JS clone of the server from MainActivity (for testing).
 */
class Server {
    constructor(port=2224) {
        this.port = port;

        this.server = http.createServer();
        this.server.listen(this.port);

        this.server.on('request', (request, response) => this.handle(request, response));

        window.addEventListener('unload', () => this.server.close());
    }

    handle(request, response) {
        console.log(request);
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
            else if (path === '/resume') { controls.resume(); response.end(); }
            else if (path === '/pause')  { controls.pause(); response.end(); }
            else if (path === '/vol')    { response.end(); }
            else if (request.method === 'POST') {
                request.pipe(concat(async (msg) => {
                    console.log(msg);
                    var c = await action(JSON.parse(msg));
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
