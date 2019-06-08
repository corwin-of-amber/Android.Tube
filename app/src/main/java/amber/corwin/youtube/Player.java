package amber.corwin.youtube;

import android.app.Activity;
import android.content.Context;
import android.media.MediaPlayer;
import android.net.Uri;
import android.view.ViewGroup;
import android.widget.LinearLayout;
import android.widget.MediaController;
import android.widget.VideoView;

public class Player {
    private Activity context;

    private MediaPlayer mediaPlayer;
    private MediaController mediaController;
    private VideoView video;

    Player(Activity context) {
        this.context = context;
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
    }

    void playMedia(final Uri uri) {
        context.runOnUiThread(new Runnable() {
            @Override
            public void run() {
                video.setVideoURI(uri);
            }
        });
    }

    private void onVideoReady(MediaPlayer mediaPlayer) {
        this.mediaPlayer = mediaPlayer;
        mediaPlayer.setVolume(0.5f, 0.5f);
        video.setLayoutParams(
                new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,
                        ViewGroup.LayoutParams.WRAP_CONTENT));
        video.start();
    }
}
