package amber.corwin.youtube;

import android.app.Activity;
import android.media.audiofx.Equalizer;
import android.media.audiofx.LoudnessEnhancer;
import android.net.Uri;
import android.os.Handler;
import android.util.Log;
import android.widget.MediaController;
import android.widget.Toast;
import android.widget.VideoView;

import org.json.JSONException;
import org.videolan.libvlc.LibVLC;
import org.videolan.libvlc.Media;
import org.videolan.libvlc.MediaPlayer;

import java.io.File;
import java.io.IOException;
import java.util.Timer;
import java.util.TimerTask;



public class PlayerVLC {

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
    private float loudnessAdjust = 1.0f;

    private UriHandler uriHandler = null;

    private Error error = null;

    PlayerVLC(Activity context) {
        this.context = context;
    }

    void setUriHandler(UriHandler handler) {
        uriHandler = handler;
    }

    void attach(VideoView video) {
        /* @todo video is deprecated for now */
    }

    private MediaPlayer setup() {
        Log.d(TAG, "player setup");
        cleanup();

        MediaPlayer player = new MediaPlayer(new LibVLC(context));
        playNextWhenDone(player);

        return player;
    }

    private void engage(MediaPlayer player, final String title) throws IOException {
        Log.d(TAG, "player engage");

        assert mediaPlayer == null;
        mediaPlayer = player;
        loudnessAdjust = 1.0f;

        player.setVolume(Math.round(volume * 100));
        player.play();
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
                player.setMedia(new Media(player.getLibVLC(), uri));
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
            player.setMedia(new Media(player.getLibVLC(), Uri.fromFile(file)));
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
        player.setEventListener(new MediaPlayer.EventListener() {
            @Override
            public void onEvent(MediaPlayer.Event event) {
                switch (event.type) {
                    case MediaPlayer.Event.EndReached:
                        /* only do it if `player` is the current MediaPlayer */
                        if (PlayerVLC.this.mediaPlayer == player) {
                            playNext();
                        }
                        break;
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
        this.playlist = playlist;
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
        if (mediaPlayer != null && !mediaPlayer.isPlaying()) mediaPlayer.play();
    }

    public boolean isPlaying() { return mediaPlayer != null && mediaPlayer.isPlaying(); }
    public boolean isRequesting() { return nowPlaying != null; }

    public void setVolume(int level, int max) {
        setVolume((float)level / max);
    }

    public void setVolume(float volume){
        this.volume = volume;
        if (mediaPlayer != null)
            mediaPlayer.setVolume(Math.round(volume * loudnessAdjust * 100));
    }

    public void setVolume(VolumeSetting vol) {
        setVolume(vol.level, vol.max);
    }

    public VolumeSetting getVolume() {
        return new VolumeSetting((int)(volume * 1000), 1000);
    }

    public PlaybackPosition getPosition() {
        try {
            if (mediaPlayer != null)
                return new PlaybackPosition((int)mediaPlayer.getTime(), (int)mediaPlayer.getLength());
            else
                return null;
        }
        catch (IllegalStateException e) {   /* MediaPlayer not ready */
            return null;
        }
    }

    public void setPosition(int seekTo) {
        Log.d(TAG, "seek to " + seekTo);
        mediaPlayer.setTime(seekTo, false);
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
            loudnessAdjust = (float)Math.pow(10, millibels * 0.001);
            setVolume(volume);
        }
    }

    private void cleanup() {
        if (mediaPlayer != null) {
            mediaPlayer.setEventListener(null);
            if (mediaPlayer.isPlaying()) mediaPlayer.stop();
            queueRelease(mediaPlayer);
        }
        mediaPlayer = null;
        nowPlaying = null;
        nowPlayingUri = null;
    }

    private void queueRelease(final MediaPlayer player) {
        new Handler().postDelayed(new Runnable() {
            @Override
            public void run() {
                player.release();
            }
        }, MEDIA_PLAYER_RELEASE_DELAY);
    }

    /*
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
    */

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
