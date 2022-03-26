package amber.corwin.youtube;

import android.app.Activity;
import android.media.AudioManager;
import android.media.MediaPlayer;
import android.media.audiofx.Equalizer;
import android.media.audiofx.LoudnessEnhancer;
import android.net.Uri;
import android.os.Build;
import android.os.Handler;
import android.os.PowerManager;
import android.os.SystemClock;
import android.util.Log;
import android.view.ViewGroup;
import android.widget.LinearLayout;
import android.widget.MediaController;
import android.widget.Toast;
import android.widget.VideoView;

import org.json.JSONException;

import java.io.File;
import java.io.IOException;
import java.util.Timer;
import java.util.TimerTask;


public class Player {

    static final String TAG = "Player";

    static private int MEDIA_PLAYER_RELEASE_DELAY = 3 * 60 * 1000;

    private Activity context;

    private MediaPlayer mediaPlayer;
    private MediaController mediaController;
    private VideoView video;

    private float volume = 1.0f;

    private Playlist playlist;
    private Playlist.Track nowPlaying;
    private Uri nowPlayingUri;
    private boolean isPrepared;
    private LoudnessEnhancer loud;
    private Equalizer eqz;
    private final Timer timer = new Timer();

    private UriHandler uriHandler = null;

    private Error error = null;

    Player(Activity context) {
        this.context = context;
    }

    void setUriHandler(UriHandler handler) {
        uriHandler = handler;
    }

    void attach(VideoView video) {
        this.video = video;
        mediaController = new MediaController(context);
        mediaController.setAnchorView(video);
        video.setMediaController(mediaController);
        video.setOnPreparedListener(new MediaPlayer.OnPreparedListener() {
            @Override
            public void onPrepared(MediaPlayer mediaPlayer) {
                onVideoReady(mediaPlayer);
            }
        });
        video.setOnErrorListener(new MediaPlayer.OnErrorListener() {
            @Override
            public boolean onError(MediaPlayer mediaPlayer, int what, int extra) {
                onVideoError(mediaPlayer, what, extra);
                return true;
            }
        });
    }

    private MediaPlayer setup() {
        Log.d(TAG, "player setup");
        cleanup();

        MediaPlayer player = new MediaPlayer();
        player.setAudioStreamType(AudioManager.STREAM_MUSIC);
        playNextWhenDone(player);

        return player;
    }

    private void engage(MediaPlayer player, final String title) throws IOException {
        Log.d(TAG, "player engage");

        assert mediaPlayer == null;
        mediaPlayer = player;
        isPrepared = false;
        loud = null;
        eqz = null;

        player.setVolume(volume, volume);
        /* sync version */
        /*
        player.prepare();
        try {
            Thread.sleep(1000);
        }
        catch (InterruptedException e) { }
        player.start();*/

        /* async version */
        player.prepareAsync();
        player.setOnPreparedListener(new MediaPlayer.OnPreparedListener() {
            @Override
            public void onPrepared(MediaPlayer player) {
                if (isPrepared) return;
                isPrepared = true;
                player.setOnErrorListener(new MediaPlayer.OnErrorListener() {
                    @Override
                    public boolean onError(MediaPlayer mediaPlayer, int i, int i1) {
                        Log.e(TAG, "player error " + i + " " + i1); return false;
                    }
                });
                timer.schedule(new TimerTask() {
                    @Override
                    public void run() {
                        player.start();
                    }
                }, 1000); /* it's a hack */
            }
        });
        player.setOnErrorListener(new MediaPlayer.OnErrorListener() {
            @Override
            public boolean onError(MediaPlayer player, int what, int extra) {
                onVideoError(player, what, extra);
                return true;
            }
        });
    }

    public void playMedia(final Uri uri, Uri originalUri) {
        Uri setUri = (originalUri == null) ? uri : originalUri;

        if ("file".equals(uri.getScheme())) {
            playFile(new File(context.getCacheDir(), uri.getPath()), setUri);
            return;
        }

        if (this.video != null) {
            context.runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    video.setVideoURI(uri);
                }
            });
        }
        else {
            MediaPlayer player = setup();
            try {
                nowPlayingUri = setUri; /* track is set by playTrack if needed */
                player.setDataSource(context.getApplicationContext(), uri);
                engage(player, uri.toString());
            }
            catch (IOException e) {
                playerError("Failed to open " + uri + ": " + e.getMessage());
            }
        }
    }

    void playFile(final File file, Uri uri) {
        MediaPlayer player = setup();
        try {
            nowPlayingUri = uri;
            player.setDataSource(file.toURI().toString());
            engage(player, file.getPath());
        }
        catch (IOException e) {
            playerError("Failed to open " + file.getPath() + ": " + e.getMessage());
        }
    }

    void playTrack(final Playlist.Track track) {
        nowPlaying = track;
        if (track.kind != null && uriHandler != null)
            uriHandler.resolveTrack(track, new UriHandler.Callback() {
                @Override
                public void resolved(Uri uri) {
                    playTrack(track, uri);
                }
            });
        else
            playTrack(track, track.uri);
    }

    void playTrack(Playlist.Track track, Uri uri) {
        playMedia(uri, track.uri);
        nowPlaying = track;

        if (mediaPlayer != null) {
            if (track.gain != 0)
                amplify(track.gain);
        }
    }

    int enqueueTrack(Playlist.Track track, boolean forPlay) {
        int index = enqueueTrack(track);
        if (forPlay && !isPlaying() && !isRequesting()) {
            playlist.nowPlaying = index;
            playTrack(track);
        }
        return index;
    }

    int enqueueTrack(Playlist.Track track) {
        if (playlist == null) {
            playlist = new Playlist();
            if (nowPlayingUri != null) {
                Playlist.Track cur = new Playlist.Track();
                cur.uri = nowPlayingUri;
                playlist.tracks.add(cur);
            }
        }
        playlist.tracks.add(track);
        return playlist.tracks.size() - 1;
    }

    public void enqueueTracks(Playlist playlist, boolean forPlay) {
        boolean first = true;
        for (Playlist.Track track : playlist.tracks) {
            enqueueTrack(track, forPlay && first);
            first = false;
        }
    }

    private void playNextWhenDone(MediaPlayer player) {
        player.setOnCompletionListener(new MediaPlayer.OnCompletionListener() {
            @Override
            public void onCompletion(MediaPlayer mediaPlayer) {
                /* only do it if `player` is the current MediaPlayer */
                if (Player.this.mediaPlayer == mediaPlayer) {
                    playNext();
                }
            }
        });
    }

    void clearTrack() {
        /* Called when preparing to play non-playlist content */
        nowPlaying = null;
    }

    private void playerError(String msg) {
        error = new Error(msg, nowPlaying);
        Toast.makeText(context, msg, Toast.LENGTH_LONG).show();
        cleanup();
    }

    public void playFromList(Playlist playlist) {
        playlist = playlist;
        playTrack(playlist.current());
    }

    public boolean playNext() {
        if (playlist != null) {
            Playlist.Track track = playlist.next();
            if (track != null) {
                playTrack(track);
                return true;
            }
        }
        if (isPlaying()) pause();
        return false;
    }

    public boolean playPrev() {
        if (playlist != null) {
            Playlist.Track track = playlist.prev();
            if (track != null) {
                playTrack(track);
                return true;
            }
        }
        return false;
    }

    public void pause() { if (isPlaying()) mediaPlayer.pause(); }

    public void resume() {
        if (mediaPlayer != null && !mediaPlayer.isPlaying()) mediaPlayer.start();
    }

    public boolean isPlaying() { return mediaPlayer != null && mediaPlayer.isPlaying(); }
    public boolean isRequesting() { return nowPlaying != null; }

    public void setVolume(int level, int max) {
        setVolume((float)level / max);
    }

    public void setVolume(float volume){
        this.volume = volume;
        if (mediaPlayer != null)
            mediaPlayer.setVolume(volume, volume);
    }

    public void setVolume(VolumeSetting vol) {
        setVolume(vol.level, vol.max);
    }

    public VolumeSetting getVolume() {
        return new VolumeSetting((int)(volume * 1000), 1000);
    }

    public PlaybackPosition getPosition() {
        try {
            if (mediaPlayer != null && isPrepared)
                return new PlaybackPosition(mediaPlayer.getCurrentPosition(), mediaPlayer.getDuration());
            else
                return null;
        }
        catch (IllegalStateException e) {   /* MediaPlayer not ready */
            return null;
        }
    }

    public void setPosition(int seekTo) {
        Log.d(TAG, "seek to " + seekTo);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O)
            mediaPlayer.seekTo(seekTo, MediaPlayer.SEEK_CLOSEST);
        else
            mediaPlayer.seekTo(seekTo);
    }

    public Uri getCurrentUri() { return nowPlayingUri; }

    public Playlist.Track getCurrentTrack() {
        return nowPlaying;
    }

    public Playlist getPlaylist() {
        return playlist;
    }

    public Error getLastError() { return error; }

    public String exportPlaylist() {
        if (playlist != null) {
            try {
                return playlist.exportJSON();
            }
            catch (JSONException e) { return null; }
        }
        else return null;
    }

    public void amplify(int millibels) {
        if (mediaPlayer != null) {
            if (loud == null) {
                loud = new LoudnessEnhancer(
                        mediaPlayer.getAudioSessionId());
            }
            loud.setTargetGain(millibels);
            loud.setEnabled(true);
            /*
            if (eqz == null)
                eqz = new Equalizer(0, mediaPlayer.getAudioSessionId());
            short n = eqz.getNumberOfBands();
            for (short i = 0; i < n; i++) {
                int[] freqRange = eqz.getBandFreqRange(i);
                short[] levelRange = eqz.getBandLevelRange();
                eqz.setBandLevel(i, (short)millibels);
            }
            eqz.setEnabled(true);*/
        }
    }

    private void cleanup() {
        if (mediaPlayer != null) {
            mediaPlayer.setOnPreparedListener(null);
            mediaPlayer.setOnErrorListener(null);
            if (mediaPlayer.isPlaying()) mediaPlayer.stop();
            queueRelease(mediaPlayer);
        }
        mediaPlayer = null;
        nowPlaying = null;
        nowPlayingUri = null;
        loud = null;
        eqz = null;
    }

    private void queueRelease(final MediaPlayer player) {
        new Handler().postDelayed(new Runnable() {
            @Override
            public void run() {
                player.release();
            }
        }, MEDIA_PLAYER_RELEASE_DELAY);
    }

    private void onVideoReady(MediaPlayer mediaPlayer) {
        this.mediaPlayer = mediaPlayer;
        mediaPlayer.setWakeMode(context, PowerManager.PARTIAL_WAKE_LOCK);
        setVolume(volume);
        video.setLayoutParams(
                new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,
                        ViewGroup.LayoutParams.WRAP_CONTENT));
        video.start();
    }

    private void onVideoError(MediaPlayer mediaPlayer, int what, int extra) {
        String err = null;
        switch (extra) {
        case MediaPlayer.MEDIA_ERROR_IO: err = "Read error"; break;
        case MediaPlayer.MEDIA_ERROR_MALFORMED: err = "Malformed stream"; break;
        case MediaPlayer.MEDIA_ERROR_UNSUPPORTED: err = "Unsupported format"; break;
        case MediaPlayer.MEDIA_ERROR_TIMED_OUT: err = "Timed out"; break;
        }

        String msg = "Can't play this video" + (err == null ? "" : "(" + err + ")");

        Toast.makeText(context, msg, Toast.LENGTH_LONG).show();
    }

    interface UriHandler {
        void resolveTrack(Playlist.Track track, Callback callback);

        interface Callback {
            void resolved(Uri uri);
        }
    }

    public static class Error {
        public String msg;
        public Playlist.Track track;
        Error(String msg, Playlist.Track track) {
            this.msg = msg;
            this.track = track;
        }
    }

}
