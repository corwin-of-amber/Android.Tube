/**
 * Quickly make sure that ytdl-core works.
 */

const y = require('@distube/ytdl-core');

var vid = 'L5Ij7z1xh1M';

async function main() {
    
    var x = await y.getInfo(vid, {playerClients: ['TV']});

    for (let fmt of x.formats) {
        console.log(fmt.itag, fmt.mimeType);
    }

    for (let fmt of x.formats) {
        if (fmt.itag == 140) {
            console.log(fmt.itag, fmt.url);
            console.log(' ->', (await fetch(fmt.url, {method: 'HEAD'})).status);
        }
    }
}


main();
