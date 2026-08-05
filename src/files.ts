
class DroppedFiles {
    static async fromEntry(entry) {
        if (entry.isFile) {
            return [await new Promise(resolve => entry.file(resolve))];
        }
        else if (entry.isDirectory) {
            let entries = await Array.fromAsync(DroppedFiles.readDirectory(entry));
            return [].concat(...(await DroppedFiles.fromEntries(entries)));
        }
        else return [];
    }

    static async fromEntries(entries: any[]) {
        var length = entries.length, ret = [];
        for (var i = 0; i < length; i++) {
            ret.push(DroppedFiles.fromEntry(entries[i]));
        }
        return [].concat(...(await Promise.all(ret)));
    }

    static async fromDataTransfer(dt: DataTransfer) {
        var length = dt.items.length, ret = [];
        for (var i = 0; i < length; i++) {
            var entry = dt.items[i].webkitGetAsEntry();
            if (entry) ret.push(DroppedFiles.fromEntry(entry));
        }
        return [].concat(...(await Promise.all(ret)));
    }

    static async *readDirectory(dir: FileSystemDirectoryEntry) {
        let reader = dir.createReader();
        while (true) {
            let r = await new Promise<any[]>((resolve, reject) =>
                reader.readEntries(resolve, reject));
            if (r.length == 0) break;
            yield* r;
        }
    }
}


export { DroppedFiles }