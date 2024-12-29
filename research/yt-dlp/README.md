yt-dlp is somewhat ahead of distube-js when it comes to Youtube protocol premissions.
Hence it is sometimes useful to observe the requests that yt-dlp is making when figuring out 403
errors in streams.

To do that, run yt-dlp with `-v --print-traffic`. The headers and POST data will be shown in the log.
Below is an excerpt from a player JSON API request, and a utility function that allows you to make the same request, for research purposes.

```js
const ytdlp = `
send: b'POST /youtubei/v1/player?prettyPrint=false HTTP/1.1\r\nContent-Length: 329\r\nHost: www.youtube.com\r\nCookie: PREF=hl=en&tz=UTC; SOCS=CAI; GPS=1; YSC=Nl43rSo8mh4; VISITOR_INFO1_LIVE=hT5QvE0nTSY; VISITOR_PRIVACY_METADATA=CgJJTBIEGgAgOw%3D%3D; __Secure-ROLLOUT_TOKEN=CJXsw6e0lPvrpAEQ-_j3l7XKigMY-_j3l7XKigM%3D\r\nUser-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/95.0.4638.50 Safari/537.36\r\nAccept: text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8\r\nAccept-Language: en-us,en;q=0.5\r\nSec-Fetch-Mode: navigate\r\nContent-Type: application/json\r\nX-Youtube-Client-Name: 7\r\nX-Youtube-Client-Version: 7.20241201.18.00\r\nOrigin: https://www.youtube.com\r\nX-Goog-Visitor-Id: CgtoVDVRdkUwblRTWSjX0L-7BjIKCgJJTBIEGgAgOw%3D%3D\r\nAccept-Encoding: gzip, deflate\r\nConnection: close\r\n\r\n'
send: b'{"context": {"client": {"clientName": "TVHTML5", "clientVersion": "7.20241201.18.00", "hl": "en", "timeZone": "UTC", "utcOffsetMinutes": 0}}, "videoId": "L5Ij7z1xh1M", "playbackContext": {"contentPlaybackContext": {"html5Preference": "HTML5_PREF_WANTS", "signatureTimestamp": 20073}}, "contentCheckOk": true, "racyCheckOk": true}'
`

function parseYtdlRequest(reqdata) {
  let path = reqdata.match(/'POST (\S*)/)[1],
    headers = [...reqdata.matchAll(/^(.*?): (.*)/gm)]
      .map(mo => [mo[1], mo[2]]).filter(([k, v]) => k !== 'send'),
      body = reqdata.match(/b'(.*)'/)[1]

  return {
    method: "POST",
    query: { prettyPrint: false },
    headers: Object.fromEntries(headers),
    body
  }
}
```


In this case, the respective `opts` object will be:
```js
  const opts = {
    requestOptions: {
      method: 'POST',
      query: { prettyPrint: false },
      headers: {
        'Content-Length': '329',
        Host: 'www.youtube.com',
        Cookie: 'PREF=hl=en&tz=UTC; SOCS=CAI; GPS=1; YSC=Nl43rSo8mh4; VISITOR_INFO1_LIVE=hT5QvE0nTSY; VISITOR_PRIVACY_METADATA=CgJJTBIEGgAgOw%3D%3D; __Secure-ROLLOUT_TOKEN=CJXsw6e0lPvrpAEQ-_j3l7XKigMY-_j3l7XKigM%3D',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/95.0.4638.50 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-us,en;q=0.5',
        'Sec-Fetch-Mode': 'navigate',
        'Content-Type': 'application/json',
        'X-Youtube-Client-Name': '7',
        'X-Youtube-Client-Version': '7.20241201.18.00',
        Origin: 'https://www.youtube.com',
        'X-Goog-Visitor-Id': 'CgtoVDVRdkUwblRTWSjX0L-7BjIKCgJJTBIEGgAgOw%3D%3D',
        'Accept-Encoding': 'gzip, deflate',
        Connection: 'close',
        ...options.requestOptions.headers
      },
      body: '{"context": {"client": {"clientName": "TVHTML5", "clientVersion": "7.20241201.18.00", "hl": "en", "timeZone": "UTC", "utcOffsetMinutes": 0}}, "videoId": "L5Ij7z1xh1M", "playbackContext": {"contentPlaybackContext": {"html5Preference": "HTML5_PREF_WANTS", "signatureTimestamp": 20073}}, "contentCheckOk": true, "racyCheckOk": true}'
    }
  }
```

This can be passed to `utils.request` like in `playerAPI` (`lib/info.js`).