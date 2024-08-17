const fs = require('fs');
const commander = require('commander');

let prog = new commander.Command()
  .arguments("<url>")
  .action(function(url) { this.url = url });

let o = prog.parse(process.argv);


function getDateOf(url) {
    let mo = url.match(/(\d{4})(\d{2})(\d{2})/);
    if (mo)
        return `${mo[1]}-${mo[2]}-${mo[3]}`;
}

async function main(url) {
    console.log("Fetching", url);
    let prefix = getDateOf(url) ?? '';
    
    let page = await (await fetch(url)).text();
    let mo = page.match(/"jsUrl":"(.*?)"/);
    if (!mo) throw new Error("jsUrl not found");

    let jsUrl = mo[1];

    mo = jsUrl.match(/[/]([0-9a-f]{5,})[/]/);
    if (!mo) throw new Error("no player hash in jsUrl " + jsUrl);
    let hash = mo[1];

    console.log("Fetching", jsUrl);
    let player = await (await fetch(new URL(jsUrl, new URL("https://www.youtube.com")))).text();

    let outfn = `research/yt-player/${prefix}-${hash}.js`;
    fs.writeFileSync(outfn, player);
    console.log("Wrote", outfn);
}


main(o.url);
