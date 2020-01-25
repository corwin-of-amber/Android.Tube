package amber.corwin.youtube;

import android.net.Uri;
import android.util.JsonReader;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;
import org.json.JSONTokener;

import java.io.StringReader;
import java.util.ArrayList;
import java.util.Collection;
import java.util.List;
import java.util.Random;


public class Playlist {

    static class Track {
        public String id;
        public String kind;
        public Uri uri;
        public int gain;
    }

    List<Track> tracks;
    int nowPlaying;

    public Playlist(Collection<Track> tracks) {
        this.tracks = new ArrayList<>();
        this.tracks.addAll(tracks);
        nowPlaying = 0;
    }

    public Track current() {
        return tracks.get(nowPlaying);
    }

    public Track next() {
        if (nowPlaying < tracks.size() - 1) {
            nowPlaying++;
            return current();
        }
        else
            return null;
    }

    public Playlist shuffle() {
        Random random = new Random();
        List<Track> shuffle = new ArrayList<>(tracks.size());
        while (tracks.size() > 0) {
            int i = random.nextInt(tracks.size());
            shuffle.add(tracks.get(i));
            tracks.remove(i);
        }
        tracks = shuffle;
        return this;
    }

    public static Playlist fromJSON(String jsonText) throws JSONException {
        JSONObject object = (JSONObject) new JSONTokener(jsonText).nextValue();
        return fromJSON(object);
    }

    public static Playlist fromJSON(JSONObject json) throws JSONException {
        JSONArray jsonTracks = json.getJSONArray("tracks");
        List<Track> tracks = new ArrayList<>();

        for (int i = 0; i < jsonTracks.length(); i++) {
            JSONObject jsonTrack = jsonTracks.getJSONObject(i);
            Track track = new Track();
            track.id = jsonTrack.getString("id");
            track.kind = jsonTrack.optString("kind", null);
            track.uri = Uri.parse(jsonTrack.getString("uri"));
            track.gain = jsonTrack.optInt("gain", 0);
            tracks.add(track);
        }

        Playlist playlist = new Playlist(tracks);

        if (json.has("nowPlaying"))
            playlist.nowPlaying = json.getInt("nowPlaying");

        return playlist;
    }
}
