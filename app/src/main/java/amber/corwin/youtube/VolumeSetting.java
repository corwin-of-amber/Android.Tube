package amber.corwin.youtube;

public class VolumeSetting {

    public int level;
    public int max;

    VolumeSetting(int level, int max) { this.level = level; this.max = max; }

    @Override
    public String toString() {
        return "" + level + "/" + max;
    }

    static VolumeSetting parse(String s) {
        String[] parts = s.split("/");
        if (parts.length == 2) {
            int level = Integer.parseInt(parts[0]);
            int max = Integer.parseInt(parts[1]);
            if (max > 0 && level <= max)
                return new VolumeSetting(level, max);
            else throw new NumberFormatException();
        }
        else throw new NumberFormatException();
    }

}
