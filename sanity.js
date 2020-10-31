/**
 * Quickly make sure that ytdl-core works.
 */

const y = require('ytdl-core');

var vid = '3o08TyqShzw';

async function main() {
    var x = await y.getInfo(vid);

    console.log(x.formats);
}


main();
