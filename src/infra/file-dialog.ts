import path from 'path';


export function saveFile(filename: string, content: string | Uint8Array) {
    var blob = new Blob([content]), ourl = URL.createObjectURL(blob),
        a = document.createElement('a');
    a.setAttribute('href', ourl);
    a.setAttribute('download', filename);
    a.click();

    setTimeout(() => URL.revokeObjectURL(ourl), EXPIRE);
}


class FileInputElement {
    el: HTMLInputElement

    constructor(filename?: string, ext?: string) {
        var input = document.createElement('input');
        input.setAttribute('type', 'file');
        if (filename) {
            input.setAttribute('nwworkingdir', path.dirname(filename));
            input.setAttribute('nwsaveas', path.basename(filename));
        }
        if (ext) {
            if (!ext.startsWith('.')) ext = '.' + ext;
            input.setAttribute('accept', ext);
        }
        this.el = input;
    }

    get(): Promise<FileEx> {
        let el = this.el;
        return new Promise(resolve => {
            el.addEventListener('change', () => {
                if (el.files[0]) resolve(el.files[0] as FileEx);
            });
            el.click();
        });
    }

}

export function saveDialog(filename: string, ext?: string): Promise<FileEx> {
    return new FileInputElement(filename, ext).get();
}

export function openDialog(ext?: string): Promise<FileEx> {
    return new FileInputElement(undefined, ext).get();
}

/** extended file info returned from NWjs */
export type FileEx = File & {size: number, path: string};

/** max time for save-as interaction */
const EXPIRE = 900000;

