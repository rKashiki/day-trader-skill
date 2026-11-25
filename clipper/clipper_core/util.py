"""Small helpers shared by all steps: logging, ffmpeg calls, file names."""

import json
import os
import re
import shutil
import subprocess
import sys
import unicodedata
from fractions import Fraction

# Windows hides the console window of child processes only with this flag.
_NO_WINDOW = getattr(subprocess, "CREATE_NO_WINDOW", 0)


class ClipperError(Exception):
    """An error with a message meant for the user (German)."""


def log(msg=""):
    print(msg, flush=True)


def step(n, total, msg):
    log("")
    log("[%d/%d] %s" % (n, total, msg))


def fmt_time(seconds):
    seconds = max(0, int(round(seconds)))
    h, rest = divmod(seconds, 3600)
    m, s = divmod(rest, 60)
    if h:
        return "%d:%02d:%02d" % (h, m, s)
    return "%d:%02d" % (m, s)


def require_tool(name):
    path = shutil.which(name)
    if not path:
        raise ClipperError(
            "'%s' wurde nicht gefunden. Installiere ffmpeg (Windows: 'winget install Gyan.FFmpeg') "
            "und öffne danach ein neues Fenster." % name)
    return path


def run(cmd, cwd=None):
    """Run a command, raise ClipperError with the last lines of stderr on failure."""
    proc = subprocess.run(cmd, cwd=cwd, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
                          creationflags=_NO_WINDOW)
    if proc.returncode != 0:
        tail = proc.stderr.decode("utf-8", "replace").strip().splitlines()[-15:]
        raise ClipperError("Befehl fehlgeschlagen: %s\n%s" % (cmd[0], "\n".join(tail)))
    return proc.stdout


def popen(cmd, cwd=None, stdin=None, stdout=None, stderr=None):
    return subprocess.Popen(cmd, cwd=cwd, stdin=stdin, stdout=stdout, stderr=stderr,
                            creationflags=_NO_WINDOW)


def probe(path):
    """Return duration, size, frame rate and audio presence of a video file."""
    out = run(["ffprobe", "-v", "error", "-print_format", "json", "-show_format",
               "-show_streams", path])
    data = json.loads(out.decode("utf-8", "replace"))
    video = next((s for s in data.get("streams", []) if s.get("codec_type") == "video"), None)
    if video is None:
        raise ClipperError("Die Datei enthält keine Videospur: %s" % path)
    has_audio = any(s.get("codec_type") == "audio" for s in data.get("streams", []))
    duration = float(data.get("format", {}).get("duration") or video.get("duration") or 0)
    width, height = int(video["width"]), int(video["height"])
    # Rotated phone videos report the unrotated size.
    rotation = 0
    for side in video.get("side_data_list", []) or []:
        if "rotation" in side:
            rotation = int(side["rotation"])
    if abs(rotation) % 180 == 90:
        width, height = height, width
    return {
        "duration": duration,
        "width": width,
        "height": height,
        "fps": _pick_fps(video),
        "has_audio": has_audio,
    }


def _pick_fps(video):
    """Constant output frame rate: the source rate, capped at 60, as an ffmpeg rational."""
    for key in ("avg_frame_rate", "r_frame_rate"):
        raw = video.get(key) or "0/0"
        try:
            num, den = raw.split("/")
            if int(den) == 0 or int(num) == 0:
                continue
            fps = Fraction(int(num), int(den))
        except ValueError:
            continue
        if 10 <= fps <= 61:
            return fps.limit_denominator(1001)
    return Fraction(30, 1)


_INVALID = re.compile(r'[<>:"/\\|?*\x00-\x1f]')
_RESERVED = {"CON", "PRN", "AUX", "NUL"} | {"COM%d" % i for i in range(1, 10)} | \
            {"LPT%d" % i for i in range(1, 10)}


def safe_filename(text, maxlen=60, fallback="clip"):
    """A file name that works on Windows: no reserved characters, no trailing dots."""
    text = unicodedata.normalize("NFC", text or "")
    text = _INVALID.sub("", text)
    text = re.sub(r"\s+", " ", text).strip()
    text = text[:maxlen].rstrip(" .")
    if not text or text.upper() in _RESERVED:
        text = fallback
    return text


def unique_dir(base):
    """base, or base (2), base (3), ... whichever does not exist yet."""
    if not os.path.exists(base):
        return base
    i = 2
    while os.path.exists("%s (%d)" % (base, i)):
        i += 1
    return "%s (%d)" % (base, i)


def open_folder(path):
    """Open a folder in Explorer/Finder; silently ignore failures."""
    try:
        if sys.platform.startswith("win"):
            os.startfile(path)  # noqa: S606 (only exists on Windows)
        elif sys.platform == "darwin":
            subprocess.Popen(["open", path])
        else:
            subprocess.Popen(["xdg-open", path], stdout=subprocess.DEVNULL,
                             stderr=subprocess.DEVNULL)
    except Exception:
        pass
