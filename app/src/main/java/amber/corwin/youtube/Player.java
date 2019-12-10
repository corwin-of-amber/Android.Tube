package amber.corwin.youtube;

import android.app.Activity;
import android.media.AudioManager;
import android.media.MediaPlayer;
import android.net.Uri;
import android.os.AsyncTask;
import android.os.ParcelFileDescriptor;
import android.os.PowerManager;
import android.util.Log;
import android.view.ViewGroup;
import android.widget.LinearLayout;
import android.widget.MediaController;
import android.widget.Toast;
import android.widget.VideoView;

import java.io.File;
import java.io.FileDescriptor;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.lang.ref.WeakReference;
import java.net.URL;



public class Player {

    static final String TAG = "Player";

    private Activity context;

    private MediaPlayer mediaPlayer;
    private MediaController mediaController;
    private VideoView video;

    private float volume = 1.0f;

    private Playlist playlist;

    private UriHandler uriHandler = null;

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
        if (mediaPlayer != null) mediaPlayer.stop();

        MediaPlayer player = new MediaPlayer();
        player.setAudioStreamType(AudioManager.STREAM_MUSIC);

        return player;
    }

    private void engage(MediaPlayer player) throws IOException {
        player.setVolume(volume, volume);
        player.prepare();
        player.start();
        mediaPlayer = player;
    }

    public void playMedia(final Uri uri) {
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
                player.setDataSource(this.context.getApplicationContext(), uri);
                engage(player);
            }
            catch (IOException e) {
                Toast.makeText(this.context, "Failed to open " + uri, Toast.LENGTH_LONG).show();
                mediaPlayer = null;
            }
        }
    }

    public void playFile(final File file) {
        MediaPlayer player = setup();
        try {
            player.setDataSource(file.toURI().toString());
            engage(player);
        }
        catch (IOException e) {
            Toast.makeText(this.context, "Failed to open " + file.getPath(), Toast.LENGTH_LONG).show();
        }
    }

    void playTrack(final Playlist.Track track) {
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
        playMedia(uri);

        if (mediaPlayer != null) {
            mediaPlayer.setOnCompletionListener(new MediaPlayer.OnCompletionListener() {
                @Override
                public void onCompletion(MediaPlayer mediaPlayer) {
                    if (Player.this.mediaPlayer == mediaPlayer) {
                        playNext();
                    }
                }
            });
        }
    }

    public void playFromList(Playlist playlist) {
        this.playlist = playlist;
        playTrack(playlist.current());
    }

    void playNext() {
        if (this.playlist != null) {
            Playlist.Track track = playlist.next();
            if (track != null)
                playTrack(track);
        }
    }

    public void pause() {
        if (mediaPlayer != null && mediaPlayer.isPlaying()) mediaPlayer.pause();
    }

    public void resume() {
        if (mediaPlayer != null && !mediaPlayer.isPlaying()) mediaPlayer.start();
    }

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
        if (this.mediaPlayer != null)
            return new PlaybackPosition(this.mediaPlayer.getCurrentPosition(), this.mediaPlayer.getDuration());
        else
            return null;
    }

    public void setPosition(int seekTo) {
        this.mediaPlayer.seekTo(seekTo);
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

}
