package amber.corwin.youtube;

import org.json.JSONException;
import org.json.JSONObject;

public class PlaybackPosition {

    public int pos;
    public int duration;

    PlaybackPosition(int pos, int duration) { this.pos = pos; this.duration = duration; }

    @Override
    public String toString() {
        return "" + pos + "/" + duration;
    }

    static PlaybackPosition parse(String s) {
        String[] parts = s.split("/");
        if (parts.length == 1 || parts.length == 2) {
            int pos = Integer.parseInt(parts[0]);
            int duration = (parts.length > 1) ? Integer.parseInt(parts[1]) : 0;
            if (duration == 0 || (duration > 0 && pos <= duration))
                return new PlaybackPosition(pos, duration);
            else throw new NumberFormatException();
        }
        else throw new NumberFormatException();
    }

    public JSONObject toJSON() throws JSONException {
        JSONObject o = new JSONObject();
        o.put("pos", pos);
        o.put("duration", duration);
        return o;
    }
}
