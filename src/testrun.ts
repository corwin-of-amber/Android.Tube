import assert from 'assert';
import fs from 'fs';
import path from 'path';
import vm from 'vm';

import rex from 'regex-translator';


class YouTubeTestRun {

    videoId: string

    player: PlayerJS
    decrypt: DecryptFuncs

    DOMAIN = new URL('https://www.youtube.com')
    FETCH_OPTS: RequestInit = {credentials: 'omit'}

    constructor(videoId: string) {
        this.videoId = videoId;

        if (false) { /* for posterity */
            let DIR = process.env['HOME'] + '/.cache/yt-dlp/';
            this.decrypt = new DecryptFuncs()
                .fromYtDlp(path.join(DIR, 'youtube-sigfuncs/js_8a8ac953_103.json'),
                           path.join(DIR, 'youtube-nsig/8a8ac953.json'));
        }
    }

    async getInfoCompat() {
        let resp = await this.getInfoTV();

        return {
            csn: undefined,
            formats: resp['streamingData']['adaptiveFormats'].map(fmt =>
                this.decrypt.decipherStreamURL(fmt))
        };
    }

    async getInfoTV() {
        let {ytcfg: web, playerUrl} = await this.processWatchPage();
        let ytcfg = {
            'web': web,
            'tv': await this.processClientPageTV()
        };
        console.log(ytcfg);

        this.player = await new PlayerJS().fromURL(playerUrl);

        let resp = await this.makeApiRequest(ytcfg.tv, '/youtubei/v1/player?prettyPrint=false')
        console.log('resp', resp);

        this.decrypt = new DecryptFuncs().fromPlayerJS(this.player);

        return resp;
    }

    _fetch(url: URL | string, init?: RequestInit) {
        return fetch(url, {...this.FETCH_OPTS, ...init});
    }

    async go() {
        let resp = await this.getInfoTV();

        let h = String.raw`send: b'POST /youtubei/v1/player?prettyPrint=false HTTP/1.1\r\nHost: www.youtube.com\r\nConnection: keep-alive\r\nUser-Agent: Mozilla/5.0 (ChromiumStylePlatform) Cobalt/Version,gzip(gfe)\r\nAccept: text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8\r\nAccept-Language: en-us,en;q=0.5\r\nSec-Fetch-Mode: navigate\r\nContent-Type: application/json\r\nX-Youtube-Client-Name: 7\r\nX-Youtube-Client-Version: 7.20250330.13.00-canary_experiment_7.20250326.09.00\r\nOrigin: https://www.youtube.com\r\nX-Goog-Visitor-Id: CgtsdGV4MkRJMGVxTSi7hKy_BjIKCgJJTBIEGgAgLg%3D%3D\r\nAccept-Encoding: gzip, deflate\r\nCookie: PREF=hl=en&tz=UTC; SOCS=CAI; GPS=1; YSC=sn0WnwFIwbI; __Secure-ROLLOUT_TOKEN=CLWUyODP2YO6ywEQ8M7Slpu1jAMY1YSAl5u1jAM%3D; VISITOR_INFO1_LIVE=ltex2DI0eqM; VISITOR_PRIVACY_METADATA=CgJJTBIEGgAgLg%3D%3D; __Secure-YT_TVFAS=t=484292&s=2; DEVICE_INFO=ChxOelE0T0RBNE1USTJNemszTmpjNE9EQXhNZz09ELyErL8GGLyErL8G\r\nContent-Length: 1324\r\n\r\n'`,
            b = `send: b'{"context": {"client": {"hl": "en", "gl": "IL", "remoteHost": "79.177.131.196", "deviceMake": "", "deviceModel": "", "visitorData": "CgtsdGV4MkRJMGVxTSi8hKy_BjIKCgJJTBIEGgAgLg%3D%3D", "userAgent": "Mozilla/5.0 (ChromiumStylePlatform) Cobalt/Version,gzip(gfe)", "clientName": "TVHTML5", "clientVersion": "7.20250330.13.00-canary_experiment_7.20250326.09.00", "osVersion": "", "originalUrl": "https://www.youtube.com/tv", "theme": "CLASSIC", "platform": "DESKTOP", "clientFormFactor": "UNKNOWN_FORM_FACTOR", "webpSupport": false, "configInfo": {"appInstallData": "CLyErL8GEMuazhwQk9nOHBD1g7giEK3yzhwQgoO4IhDCyc4cEK_zzhwQz7nOHBCk6s4cEOODuCIQ39zOHCoIQ0FNU0FoMEg%3D"}, "tvAppInfo": {"appQuality": "TV_APP_QUALITY_FULL_ANIMATION"}, "timeZone": "UTC", "acceptHeader": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8", "deviceExperimentId": "ChxOelE0T0RBNE1USTJNemszTmpjNE9EQXhNZz09ELyErL8GGLyErL8G", "rolloutToken": "CLWUyODP2YO6ywEQ8M7Slpu1jAMY1YSAl5u1jAM%3D", "utcOffsetMinutes": 0}, "user": {"lockedSafetyMode": false}, "request": {"useSsl": true}, "clickTracking": {"clickTrackingParams": "IhMIkP7/lpu1jAMVCsdJBx2XwgFC"}}, "videoId": "L5Ij7z1xh1M", "playbackContext": {"contentPlaybackContext": {"html5Preference": "HTML5_PREF_WANTS", "signatureTimestamp": 20174}}, "contentCheckOk": true, "racyCheckOk": true}'`
        //this.replayFromYtdlp(h, b);

        for (let format of resp['streamingData']['adaptiveFormats']) {
            if (format.itag === 140) {
                this.decrypt.decipherStreamURL(format);
            }
        }

    }

    // yt-dlp:_video.py:_download_player_responses
    async processWatchPage() {
        let query = {'v': this.videoId, 'bpctr': '9999999999', 'has_verified': '1'},
            cookie = 'PREF=hl=en&tz=UTC; SOCS=CAI';
        let watchUrl = `https://www.youtube.com/watch?${new URLSearchParams(query)}`;
        let req = await this._fetch(watchUrl, {headers: {'Cookie': cookie}}),
            webpage = await req.text();

        let ytcfg = this.extract_ytcfg(this.videoId, webpage),
            playerUrl = this.extract_player_url(ytcfg);

        return {ytcfg, playerUrl};
    }

    async processClientPageTV() {
        let clientUrl = new URL('/tv', this.DOMAIN);
        let req = await this._fetch(clientUrl, {credentials: 'omit'}),
            webpage = await req.text();
        //let webpage = fs.readFileSync('/tmp/webpage-tv', 'utf-8');
        return this.extract_ytcfg(this.videoId, webpage);
    }

    // yt-dlp:_video.py
    extract_ytcfg(video_id, webpage) {
        if (!webpage)
            return {}

        let mo = webpage.match(/ytcfg\.set\s*\(\s*({.+?})\s*\)\s*;/);
        if (mo) return JSON.parse(mo[1]);
        /* (Python)
        return self._parse_json(
            self._search_regex(
                r'ytcfg\.set\s*\(\s*({.+?})\s*\)\s*;', webpage, 'ytcfg',
                default='{}'), video_id, fatal=False) or {} */
    }

    // yt-dlp:_video.py:_extract_player_url
    extract_player_url(ytcfg) {
        let p = ytcfg['PLAYER_JS_URL']; /** @todo */
        return new URL(p, this.DOMAIN);
    }

    // yt-dlp:_basey.py:_extract_context
    extract_context(ytcfg) {
        let context = ytcfg?.INNERTUBE_CONTEXT,
            client_context = context?.client;
        if (client_context)
            Object.assign(client_context, {'hl': 'en', 'timeZone': 'UTC', 'utcOffsetMinutes': 0});
        return context;
        /* Python
        context = get_first(
            (ytcfg, self._get_default_ytcfg(default_client)), 'INNERTUBE_CONTEXT', expected_type=dict)
        # Enforce language and tz for extraction
        client_context = traverse_obj(context, 'client', expected_type=dict, default={})
        client_context.update({'hl': self._preferred_lang or 'en', 'timeZone': 'UTC', 'utcOffsetMinutes': 0})
        return context
        */
    }

    // yt-dlp:_video.py:_extract_visitor_data
    extract_visitor_data(ytcfg) {
        return ytcfg?.INNERTUBE_CONTEXT?.client?.visitorData;
        /*
        if visitor_data := self._configuration_arg('visitor_data', [None], ie_key=CONFIGURATION_ARG_KEY, casesense=True)[0]:
            return visitor_data
        return get_first(
            args, [('VISITOR_DATA', ('INNERTUBE_CONTEXT', 'client', 'visitorData'), ('responseContext', 'visitorData'))],
            expected_type=str)
        */
    }

    // yt-dlp:_video.py:_extract_data_sync_id
    extract_data_sync_id(ytcfg) {
        return ytcfg?.DATASYNC_ID;
        /* Python
        if data_sync_id := self._configuration_arg('data_sync_id', [None], ie_key=CONFIGURATION_ARG_KEY, casesense=True)[0]:
            return data_sync_id

        return traverse_obj(
            args, (..., ('DATASYNC_ID', ('responseContext', 'mainAppWebResponseContext', 'datasyncId')), {str}, any))
        */
    }

    // yt-dlp:_base.py:_extract_session_index
    extract_session_index(ytcfg) {
        return ytcfg?.SESSION_INDEX;
        /* Python
        for ytcfg in data:
            session_index = int_or_none(try_get(ytcfg, lambda x: x['SESSION_INDEX']))
            if session_index is not None:
                return session_index
        */
    }

    // yt-dlp:_base.py:_extract_client_name
    extract_client_name(ytcfg) {
        return ytcfg?.INNERTUBE_CLIENT_NAME ??
               ytcfg?.INNERTUBE_CONTEXT?.client?.clientName;
        /* Python
        return self._ytcfg_get_safe(
            ytcfg, (lambda x: x['INNERTUBE_CLIENT_NAME'],
                    lambda x: x['INNERTUBE_CONTEXT']['client']['clientName']), str, default_client)
        */
    }

    // yt-dlp:_base.py:_extract_client_version
    extract_client_version(ytcfg) {
        return ytcfg?.INNERTUBE_CLIENT_VERSION ??
               ytcfg?.INNERTUBE_CONTEXT?.client?.clientVersion;
        /* Python
        return self._ytcfg_get_safe(
            ytcfg, (lambda x: x['INNERTUBE_CLIENT_VERSION'],
                    lambda x: x['INNERTUBE_CONTEXT']['client']['clientVersion']), str, default_client)
        */
    }

    // yt-dlp:_video.py:_extract_signature_timestamp
    extract_signature_timestamp(ytcfg) {
        let s = ytcfg?.['STS'];
        if (typeof s === 'string' && s.match(/^\d+$/))
            return parseInt(s);

        if (this.player.source) {
            let mo = this.player.source.match(/(?:signatureTimestamp|sts)\s*:\s*(?<sts>[0-9]{5})/);
            if (mo) {
                return +mo.groups['sts'];
            }
        }

        /* Python
        sts = None
        if isinstance(ytcfg, dict):
            sts = int_or_none(ytcfg.get('STS'))

        if not sts:
            # Attempt to extract from player
            if player_url is None:
                error_msg = 'Cannot extract signature timestamp without player_url.'
                if fatal:
                    raise ExtractorError(error_msg)
                self.report_warning(error_msg)
                return
            code = self._load_player(video_id, player_url, fatal=fatal)
            if code:
                sts = int_or_none(self._search_regex(
                    r'(?:signatureTimestamp|sts)\s*:\s*(?P<sts>[0-9]{5})', code,
                    'JS player signature timestamp', group='sts', fatal=fatal))
        return sts
        */
    }

    // yt-dlp:_video.py:_get_checkok_params
    get_checkok_params() {
        return {'contentCheckOk': true, 'racyCheckOk': true};
    }

    // yt-dlp:_video.py:_generate_player_context
    generate_player_context(sts) {
        let context = {
            'html5Preference': 'HTML5_PREF_WANTS'
        }
        if (sts !== undefined)
            context['signatureTimestamp'] = sts;
        return {
            'playbackContext': {
                'contentPlaybackContext': context,
            },
            ...this.get_checkok_params(),
        };
        /* Python
        context = {
            'html5Preference': 'HTML5_PREF_WANTS',
        }
        if sts is not None:
            context['signatureTimestamp'] = sts
        return {
            'playbackContext': {
                'contentPlaybackContext': context,
            },
            **cls._get_checkok_params(),
        }
        */
    }

    generate_api_headers(ytcfg) {
        const origin = this.DOMAIN.href; /** @todo? */
        return {
            'X-YouTube-Client-Name': ytcfg?.INNERTUBE_CONTEXT_CLIENT_NAME,
            'X-YouTube-Client-Version': this.extract_client_version(ytcfg),
            'Origin': origin,
            'X-Goog-Visitor-Id': this.extract_visitor_data(ytcfg),
            'User-Agent': ytcfg?.INNERTUBE_CONTEXT?.client?.userAgent,  /* actually has no effect in NWjs */            

            'Content-Type': 'application/json'
        }
        /* Python
        origin = 'https://' + (self._select_api_hostname(api_hostname, default_client))
        headers = {
            'X-YouTube-Client-Name': str(
                self._ytcfg_get_safe(ytcfg, lambda x: x['INNERTUBE_CONTEXT_CLIENT_NAME'], default_client=default_client)),
            'X-YouTube-Client-Version': self._extract_client_version(ytcfg, default_client),
            'Origin': origin,
            'X-Goog-Visitor-Id': visitor_data or self._extract_visitor_data(ytcfg),
            'User-Agent': self._ytcfg_get_safe(ytcfg, lambda x: x['INNERTUBE_CONTEXT']['client']['userAgent'], default_client=default_client),
            **self._generate_cookie_auth_headers(
                ytcfg=ytcfg,
                delegated_session_id=delegated_session_id,
                user_session_id=user_session_id,
                session_index=session_index,
                origin=origin),
        }
        */
    }

    // yt-dlp:_video.py:_extract_api_response
    generate_api_query(ytcfg, videoId: string): object {
        let yt_query = {
            videoId
        };

        if (false) /** @todo seems like this never exists? */
            yt_query['params'] = '...';

        let sts = this.extract_signature_timestamp(ytcfg);
        Object.assign(yt_query, this.generate_player_context(sts));

        return yt_query;
        /* Python
        yt_query = {
            'videoId': video_id,
        }

        default_pp = traverse_obj(
            INNERTUBE_CLIENTS, (_split_innertube_client(client)[0], 'PLAYER_PARAMS', {str}))
        if player_params := self._configuration_arg('player_params', [default_pp], casesense=True)[0]:
            yt_query['params'] = player_params

        if po_token:
            yt_query['serviceIntegrityDimensions'] = {'poToken': po_token}

        sts = self._extract_signature_timestamp(video_id, player_url, master_ytcfg, fatal=False) if player_url else None
        yt_query.update(self._generate_player_context(sts))
        */
    }

    async makeApiRequest(ytcfg, path: string) {
        let headers =  this.generate_api_headers(ytcfg),
            query = this.generate_api_query(ytcfg, this.videoId),
            data = {
                context: this.extract_context(ytcfg),
                ...query
            };

        let req = await this._fetch(new URL(path, this.DOMAIN),
            {method: 'POST', headers, body: JSON.stringify(data)});

        return await req.json();
    }
    
    async replayFromYtdlp(header: string, body: string = undefined) {

        const getBytes = s => s.match(/send: b'(.*)'/)[1].replace(/\\r\\n/g, '\r\n');

        let h = getBytes(header), b = body ? getBytes(body) : undefined,
            [, method, path] = h.match(/(POST|GET) (\S+)/),
            headers = Object.fromEntries(
                [...h.matchAll(/(.*): (.*)/g)].map(mo => [mo[1], mo[2]]));

        console.log(method, path, headers, b && JSON.parse(b));

        let req = await this._fetch(new URL(path, this.DOMAIN),
            {method: method, headers, credentials: 'same-origin', body: b});
        
        return await req.json();
    }    
}



class DecryptFuncs {

    sig: (s: string) => string
    nsig: (s: string) => string

    /**
     * Reads the sig funcs from yt-dlp JSON cache.
     */
    fromYtDlp(sigFn: string, nsigFn: string) {
        /** @todo combining multiple lengths from different files for `sig` */
        this.sig = DecryptFuncs.sigFromFile(sigFn);
        this.nsig = DecryptFuncs.sigFromFile(nsigFn);
        return this;
    }

    fromPlayerJS(player: PlayerJS) {
        let funcNames = {
                sig: this.extract_sig_name(player.source),
                nsig: this.extract_nsig_name(player.source)
            };

        this.sig = player.scope[funcNames.sig];
        this.nsig = player.scope[funcNames.nsig];
        return this;
    }

    decipherStreamURL(format) {
        let sp = new URLSearchParams(format['signatureCipher']),
            url = new URL(sp.get('url'));
        console.log(Object.fromEntries(sp.entries()));
        console.log(Object.fromEntries(url.searchParams.entries()));

        let s = sp.get('s'),
            sigkey = sp.get('sp'),
            n = url.searchParams.get('n');
        console.log({sigkey, s, n});

        url.searchParams.set(sigkey, this.sig(s));
        url.searchParams.set('n', this.nsig(n));
        console.log(url.href);

        format.url = url.href;
        format.audioCodec = format.mimeType; /** @dummy */
        return format;
    }

    _(key: string) {
        return regexd.get(key);
    }

    // yt-dlp:_video.py:_parse_sig_js
    extract_sig_name(script: string) {
        let search_regrex = (pats: RegExp[], s: string) => 
                                pats.map(p => s.match(p)).filter(x => x);
        let funcname = search_regrex([
            String.raw`\b(?P<var>[a-zA-Z0-9_$]+)&&\((?P=var)=(?P<sig>[a-zA-Z0-9_$]{2,})\(decodeURIComponent\((?P=var)\)\)`,
            String.raw`(?P<sig>[a-zA-Z0-9_$]+)\s*=\s*function\(\s*(?P<arg>[a-zA-Z0-9_$]+)\s*\)\s*{\s*(?P=arg)\s*=\s*(?P=arg)\.split\(\s*""\s*\)\s*;\s*[^}]+;\s*return\s+(?P=arg)\.join\(\s*""\s*\)`,
            String.raw`(?:\b|[^a-zA-Z0-9_$])(?P<sig>[a-zA-Z0-9_$]{2,})\s*=\s*function\(\s*a\s*\)\s*{\s*a\s*=\s*a\.split\(\s*""\s*\)(?:;[a-zA-Z0-9_$]{2}\.[a-zA-Z0-9_$]{2}\(a,\d+\))?`
        ].map(py => this._(py)), script);

        assert(funcname.length >= 1);
        return funcname[0].groups['sig'];
        /* Python
        r'\b(?P<var>[a-zA-Z0-9_$]+)&&\((?P=var)=(?P<sig>[a-zA-Z0-9_$]{2,})\(decodeURIComponent\((?P=var)\)\)',
        r'(?P<sig>[a-zA-Z0-9_$]+)\s*=\s*function\(\s*(?P<arg>[a-zA-Z0-9_$]+)\s*\)\s*{\s*(?P=arg)\s*=\s*(?P=arg)\.split\(\s*""\s*\)\s*;\s*[^}]+;\s*return\s+(?P=arg)\.join\(\s*""\s*\)',
        r'(?:\b|[^a-zA-Z0-9_$])(?P<sig>[a-zA-Z0-9_$]{2,})\s*=\s*function\(\s*a\s*\)\s*{\s*a\s*=\s*a\.split\(\s*""\s*\)(?:;[a-zA-Z0-9_$]{2}\.[a-zA-Z0-9_$]{2}\(a,\d+\))?',
        */
    }

    // yt-dlp:_video.py:_extract_n_function_name
    extract_nsig_name(script: string) {
        let funcname = [...script.matchAll(
            this._(String.raw`(?xs)
                [;\n](?:
                    (?P<f>function\s+)|
                    (?:var\s+)?
                )(?P<funcname>[a-zA-Z0-9_$]+)\s*(?(f)|=\s*function\s*)
                \((?P<argname>[a-zA-Z0-9_$]+)\)\s*\{
                (?:(?!\}[;\n]).)+
                \}\s*catch\(\s*[a-zA-Z0-9_$]+\s*\)\s*
                \{\s*return\s+%s\[%d\]\s*\+\s*(?P=argname)\s*\}\s*return\s+[^}]+\}[;\n]
                `)
            )
        ];

        /** @todo validate the placeholders via `debug_str`: */
        /*  `arr[idx].endsWith('_w8_')` */

        assert(funcname.length == 1);
        return funcname[0].groups['funcname'];

        /* Python
        varname, global_list = self._interpret_player_js_global_var(jscode, player_url)
        if debug_str := traverse_obj(global_list, (lambda _, v: v.endswith('_w8_'), any)):
            funcname = self._search_regex(
                r'''(?xs)
                    [;\n](?:
                        (?P<f>function\s+)|
                        (?:var\s+)?
                    )(?P<funcname>[a-zA-Z0-9_$]+)\s*(?(f)|=\s*function\s*)
                    \((?P<argname>[a-zA-Z0-9_$]+)\)\s*\{
                    (?:(?!\}[;\n]).)+
                    \}\s*catch\(\s*[a-zA-Z0-9_$]+\s*\)\s*
                    \{\s*return\s+%s\[%d\]\s*\+\s*(?P=argname)\s*\}\s*return\s+[^}]+\}[;\n]
                ''' % (re.escape(varname), global_list.index(debug_str)),
                jscode, 'nsig function name', group='funcname', default=None)
        */
    }

    extract_player_js_global_var_name() {
        // This may be needed at some point to validate that `arr` and `idx`
        // in `extract_nsig_name` are consistent with the global var.

        /* Python
        r'''(?x)
        (?P<q1>["\'])use\s+strict(?P=q1);\s*
        (?P<code>
            var\s+(?P<name>[a-zA-Z0-9_$]+)\s*=\s*
            (?P<value>
                (?P<q2>["\'])(?:(?!(?P=q2)).|\\.)+(?P=q2)
                \.split\((?P<q3>["\'])(?:(?!(?P=q3)).)+(?P=q3)\)
                |\[\s*(?:(?P<q4>["\'])(?:(?!(?P=q4)).|\\.)*(?P=q4)\s*,?\s*)+\]
            )
        )[;,]
        '''
        */        
    }

    static sigFromFile(fn: string) {
        let perm = JSON.parse(fs.readFileSync(fn, 'utf-8')).data as number[];
        return (s: string) =>    /** @todo something to do with splitting by '.'? */
            perm.map(i => s[i]).join('');
    }

    static nsigFromFile(fn: string) {
        let [params, body] = JSON.parse(fs.readFileSync(fn, 'utf-8')).data as [string[], string];
        return new Function(...params, body) as (s: string) => string;
    }
}


class PlayerJS {
    id: string
    source: string
    _ctx: object = undefined

    FETCH_OPTS: RequestInit = {credentials: 'omit'}

    constructor(source: string = undefined) {
        this.source = source;
    }

    async fromURL(url: URL) {
        let mo = url.pathname.match(/\/player\/([a-f0-9]+)/);
        if (mo)
            this.id = mo[1];
        this.source = await (await fetch(url, this.FETCH_OPTS)).text();
        return this;
    }

    get scope() {
        return this._ctx ??= PlayerJS.unsafeExec(PlayerJS.extractBody(this.source));
    }

    static extractBody(script: string) {
        return script.slice(script.indexOf('{var')+1, script.lastIndexOf('}'));
    }

    static unsafeExec(script: string) {
        let s = new vm.Script(script),
            o = class { encode() { } },
            ctx = {document:{}, location:{hostname:''}, XMLHttpRequest: o, navigator: {}, TextDecoder: o, TextEncoder: o, g:{}}; 
            
        s.runInNewContext(ctx);

        return ctx;
    }
}


class YtDlpRegexDepository {

    regexes: Map<string, RegExp>

    get(key: string) {
        if (!this.regexes) this._precompilationPhase();
        return this.regexes.get(this.normalizeKey(key));
    }

    normalizeKey(key: string) {
        return key.replace(/\s+/g, '');
    }

    _precompilationPhase() {
        this.regexes = new Map;
        // yt-dlp:_video.py:_extract_n_function_name
        let py = String.raw`(?xs)
            [;\n](?:
                (?P<f>function\s+)|
                (?:var\s+)?
            )(?P<funcname>[a-zA-Z0-9_$]+)\s*(?(f)|=\s*function\s*)
            \((?P<argname>[a-zA-Z0-9_$]+)\)\s*\{
            (?:(?!\}[;\n]).)+
            \}\s*catch\(\s*[a-zA-Z0-9_$]+\s*\)\s*
            \{\s*return\s+%s\[%d\]\s*\+\s*(?P=argname)\s*\}\s*return\s+[^}]+\}[;\n]
            `;
        this.regexes.set(py.replace(/\s*/g, ''), this.convertPythonRegex(
            py.replace('%s', '(?<arr>[$A-Za-z0-9_]+)').replace('%d', '(?<idx>\\d+)'), 'g'));

        // yt-dlp:_video.py:_parse_sig_js
        let pys = [
            String.raw`\b(?P<var>[a-zA-Z0-9_$]+)&&\((?P=var)=(?P<sig>[a-zA-Z0-9_$]{2,})\(decodeURIComponent\((?P=var)\)\)`,
            String.raw`(?P<sig>[a-zA-Z0-9_$]+)\s*=\s*function\(\s*(?P<arg>[a-zA-Z0-9_$]+)\s*\)\s*{\s*(?P=arg)\s*=\s*(?P=arg)\.split\(\s*""\s*\)\s*;\s*[^}]+;\s*return\s+(?P=arg)\.join\(\s*""\s*\)`,
            String.raw`(?:\b|[^a-zA-Z0-9_$])(?P<sig>[a-zA-Z0-9_$]{2,})\s*=\s*function\(\s*a\s*\)\s*{\s*a\s*=\s*a\.split\(\s*""\s*\)(?:;[a-zA-Z0-9_$]{2}\.[a-zA-Z0-9_$]{2}\(a,\d+\))?`
        ];
        for (let py of pys) {
            this.regexes.set(this.normalizeKey(py), this.convertPythonRegex(py));
        }
    }

    convertPythonRegex(re: string, flags: string = '') {
        let med = rex.getMediaryStringFromRegexString(re, 're2') as string,
            rflags = '';
        med = med.replace(/^<MOP><ZOQ>(\w+)<MCP>/, (_, fl) => { rflags = fl; return ''; });
        if (rflags.includes('x'))
            med = med.replace(/ |<LB>/g, '');  /* verbose mode (?x) */  /** @todo also comments? */
        med = med.replace(/<ZOQ>P<LES>(\w+)/g, (_,k) => `\\k<${k}>`);
        med = med.replace(/<ZOQ><MOP>\w+<MCP>/g, ''); /* `(?(f)...)`  dropping it is not strictly correct */
        med = med.replace(/<CC_VERTICALSPACE>/g, '\\s');  /* bug in regex-translator? */

        return new RegExp(rex.getRegexStringFromMediaryString(med, 'ecma'),
            flags + rflags.replace('x', ''));
    }
}

let regexd = new YtDlpRegexDepository;


export { YouTubeTestRun }