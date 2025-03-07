/**
 * This is for older JS runtimes that lack some critical APIs.
 */

if (![].findIndex) {
    Array.prototype.findIndex = function(p) {
        for (var i = 0; i < this.length; i++)
            if (p(this[i])) return i;
        return -1;
    }
}
if (![].find) {
    Array.prototype.find = function(p) {
        for (var i = 0; i < this.length; i++)
            if (p(this[i])) return this[i];
    }
}
if (![].includes) {
    Array.prototype.includes = function(el) {
        for (var i = 0; i < this.length; i++)
            if (this[i] === el) return true;
        return false;
    }
}
if (!Object.assign) {
    Object.assign = function (obj /*, ...*/) {
        for (let o of arguments) {
            if (o === obj) continue;
            for (let k in o) obj[k] = o[k];
        }
        return obj;
    };
}
if (!Object.values) {
    Object.values = function(o) { return Object.keys(o).map(function(k) { return o[k]; })};
}
if (!Promise.allSettled) {
    Promise.allSettled = async function(promises) {
        let r = [];
        for (let p of promises) {
            try       { r.push({status: 'fulfilled', value: await p}); }
            catch (e) { r.push({status: 'rejected', reason: e}); }
        }
        return r;
    }
}


/* very-poor-man's 's' flag polyfill (specifically for `@distube/ytdl-core`) */
/* (enabling unconditionally for testing purposes) */
if (!RegExp.prototype.dotAll || true) {
    let _RegExp = RegExp;
    (<any>window).RegExp = function(re: string, flags: string) {
        if (flags === 's')
            return new _RegExp(re.replaceAll('.*', '[^]*')
                                 .replaceAll('.+', '[^]+'));
        else
            return new _RegExp(re, flags);
    }
}