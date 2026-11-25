"""Step 1: get the video, either from a link (yt-dlp) or from a local file."""

import glob
import hashlib
import os
import sys

from .util import ClipperError, fmt_time, log, safe_filename


def is_url(source):
    s = source.strip().lower()
    return s.startswith(("http://", "https://", "www.", "youtube.com", "youtu.be"))


def fetch(source, work_root, max_height=1080, cookies_from_browser=""):
    """Return {"path", "id", "title", "url", "work_dir"} for a link or a file."""
    source = source.strip().strip('"').strip("'")
    if is_url(source):
        if not source.lower().startswith("http"):
            source = "https://" + source
        return _download(source, work_root, int(max_height), cookies_from_browser)
    return _local(source, work_root)


def _local(source, work_root):
    path = os.path.abspath(os.path.expanduser(source))
    if not os.path.isfile(path):
        raise ClipperError("Datei nicht gefunden: %s" % path)
    stem = os.path.splitext(os.path.basename(path))[0]
    st = os.stat(path)
    digest = hashlib.sha1(("%s|%d|%d" % (path, st.st_size, int(st.st_mtime))).encode("utf-8"))
    vid = "%s-%s" % (safe_filename(stem, 40, "video"), digest.hexdigest()[:8])
    work_dir = os.path.join(work_root, vid)
    os.makedirs(work_dir, exist_ok=True)
    log("  Lokale Datei: %s" % path)
    return {"path": path, "id": vid, "title": stem, "url": None, "work_dir": work_dir}


def _download(url, work_root, max_height, cookies_from_browser):
    try:
        import yt_dlp
    except ImportError:
        raise ClipperError("yt-dlp fehlt. Bitte setup_windows.bat erneut ausführen.")

    h = max_height
    opts = {
        "quiet": True,
        "no_warnings": True,
        "noprogress": True,
        "noplaylist": True,
        # YouTube needs a JavaScript runtime (Deno recommended, Node also works).
        "js_runtimes": {"deno": {}, "node": {}},
        "format": "bv*[height<=%d]+ba/b[height<=%d]/bv*+ba/b" % (h, h),
        "merge_output_format": "mp4",
        "progress_hooks": [_progress],
    }
    if cookies_from_browser:
        opts["cookiesfrombrowser"] = (cookies_from_browser,)

    try:
        with yt_dlp.YoutubeDL(opts) as ydl:
            info = ydl.extract_info(url, download=False)
            if info.get("_type") == "playlist":
                raise ClipperError("Das ist eine Playlist. Bitte den Link zu einem einzelnen Video verwenden.")
            if info.get("is_live"):
                raise ClipperError("Livestreams werden nicht unterstützt. Warte, bis der Stream vorbei ist.")
            vid = info["id"]
            title = info.get("title") or vid
            work_dir = os.path.join(work_root, safe_filename(vid, 40, "video"))
            os.makedirs(work_dir, exist_ok=True)
            log("  Titel: %s" % title)
            if info.get("duration"):
                log("  Länge: %s" % fmt_time(info["duration"]))

            existing = _find_video(work_dir)
            if existing:
                log("  Schon heruntergeladen, verwende die vorhandene Datei.")
                return {"path": existing, "id": vid, "title": title, "url": url, "work_dir": work_dir}

            ydl.params["outtmpl"] = {"default": os.path.join(work_dir, "video.%(ext)s")}
            ydl.process_ie_result(info, download=True)
    except ClipperError:
        raise
    except Exception as exc:  # yt_dlp.utils.DownloadError and friends
        msg = str(exc)
        hint = ""
        if "confirm you" in msg and "bot" in msg:
            hint = ("\nTipp: In settings.toml bei cookies_from_browser \"firefox\" eintragen "
                    "(und in Firefox bei YouTube angemeldet sein), oder es später erneut versuchen.")
        elif "JavaScript" in msg or "js runtime" in msg.lower():
            hint = "\nTipp: Deno installieren: winget install DenoLand.Deno"
        raise ClipperError("Download fehlgeschlagen: %s%s" % (msg, hint))

    path = _find_video(work_dir)
    if not path:
        raise ClipperError("Download fehlgeschlagen: keine Videodatei gefunden.")
    return {"path": path, "id": vid, "title": title, "url": url, "work_dir": work_dir}


def _find_video(work_dir):
    # The finished file is "video.mp4"; yt-dlp's partial streams look like "video.f137.mp4.part".
    for path in sorted(glob.glob(os.path.join(work_dir, "video.*"))):
        name = os.path.basename(path)
        if name.count(".") == 1 and not name.endswith((".part", ".ytdl", ".json", ".temp")):
            return path
    return None


_last = {"pct": -10}


def _progress(d):
    if d.get("status") == "downloading":
        total = d.get("total_bytes") or d.get("total_bytes_estimate") or 0
        if total:
            pct = int(d.get("downloaded_bytes", 0) * 100 / total)
            if pct >= _last["pct"] + 5 or pct < _last["pct"]:
                _last["pct"] = pct
                sys.stdout.write("\r  Download: %3d %%" % pct)
                sys.stdout.flush()
    elif d.get("status") == "finished":
        _last["pct"] = -10
        sys.stdout.write("\r  Download: 100 %\n")
        sys.stdout.flush()
