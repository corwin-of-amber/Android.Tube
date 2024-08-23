const child_process = require('child_process');


class MDFindSearch {

    filters = ['kind:music', '-onlyin', '/Users/corwin/Music']

    search(query) {
        return new Promise((resolve, reject) => {
            child_process.execFile('mdfind', [...this.filters, query], 
                {encoding: 'utf-8', shell: false},
                (error, stdout, stderr) => {
                    if (error) { console.error(`mdfind error:\n${stderr}`); reject(error); }
                    else {
                        resolve({items: stdout.split('\n').filter(x => x)
                                            .map(fn => Playlist.trackFromFile(fn))});
                    }
                });
            });
    }
}


SEARCH_SCOPES['local'] = new MDFindSearch;