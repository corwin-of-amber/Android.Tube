
class DroppedFiles {
    static async fromEntry(entry) {
        if (entry.isFile) {
            return [await new Promise(resolve => entry.file(resolve))];
        }
        else if (entry.isDirectory) {
            var entries = await new Promise<any[]>(resolve =>
                entry.createReader().readEntries(resolve));
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
}


export { DroppedFiles }