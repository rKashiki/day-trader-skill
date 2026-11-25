"""Clipper: aus einem langen Video (YouTube-Link oder Datei) fertige Hochformat-Clips machen.

Beispiele:
    python clip.py "https://www.youtube.com/watch?v=..."
    python clip.py "C:\\Videos\\podcast.mp4" --clips 8 --max 45
    python clip.py --from-json "clips\\Mein Video\\clips.json"
"""

import argparse
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
os.environ.setdefault("OPENCV_LOG_LEVEL", "ERROR")

from clipper_core import pipeline, settings as settings_mod  # noqa: E402
from clipper_core.util import ClipperError, log, open_folder  # noqa: E402


def parse_args(argv=None):
    p = argparse.ArgumentParser(
        description="Macht aus einem langen Video fertige 9:16-Clips mit Untertiteln.")
    p.add_argument("source", nargs="?", help="YouTube-Link oder Pfad zu einer Videodatei")
    p.add_argument("--clips", type=int, help="Anzahl der Clips (Standard aus settings.toml)")
    p.add_argument("--min", type=float, dest="min_seconds", help="Mindestlänge in Sekunden")
    p.add_argument("--max", type=float, dest="max_seconds", help="Höchstlänge in Sekunden")
    p.add_argument("--layout", choices=["auto", "crop", "fit"], help="Bildausschnitt")
    p.add_argument("--focus", help='Wunsch an die KI, z. B. "lustige Momente"')
    p.add_argument("--model", help="Claude-Modell, z. B. claude-sonnet-5-5")
    p.add_argument("--effort", choices=["low", "medium", "high", "xhigh", "max"],
                   help="Wie gründlich die KI nachdenkt")
    p.add_argument("--lang", help='Sprache des Videos, z. B. "de" (Standard: automatisch)')
    p.add_argument("--whisper-model", help="Whisper-Modell, z. B. large-v3")
    p.add_argument("--device", choices=["auto", "cuda", "cpu"], help="Grafikkarte oder Prozessor")
    p.add_argument("--no-captions", action="store_true", help="Ohne Untertitel")
    p.add_argument("--cookies-from-browser", help='Browser-Cookies für YouTube nutzen, z. B. "firefox"')
    p.add_argument("--from-json", help="Clips aus einer (bearbeiteten) clips.json neu rendern, ohne KI")
    p.add_argument("--settings", default=os.path.join(HERE, "settings.toml"),
                   help="Pfad zur Einstellungsdatei")
    p.add_argument("--open", action="store_true", help="Ordner mit den Clips am Ende öffnen")
    return p.parse_args(argv)


def apply_overrides(s, a):
    pairs = [
        (s.clips, "count", a.clips), (s.clips, "min_seconds", a.min_seconds),
        (s.clips, "max_seconds", a.max_seconds), (s.clips, "layout", a.layout),
        (s.clips, "focus", a.focus), (s.ai, "model", a.model), (s.ai, "effort", a.effort),
        (s.transcription, "language", a.lang), (s.transcription, "model", a.whisper_model),
        (s.transcription, "device", a.device),
        (s.download, "cookies_from_browser", a.cookies_from_browser),
    ]
    for section, key, value in pairs:
        if value is not None:
            section[key] = value
    if a.no_captions:
        s.captions.enabled = False
    settings_mod.validate(s)


def main(argv=None):
    for stream in (sys.stdout, sys.stderr):
        try:
            stream.reconfigure(encoding="utf-8")
        except (AttributeError, ValueError):
            pass
    args = parse_args(argv)
    try:
        from dotenv import load_dotenv
        load_dotenv(os.path.join(HERE, ".env"))
    except ImportError:
        pass

    try:
        s = settings_mod.load(args.settings)
        apply_overrides(s, args)
        source = args.source
        if not source and not args.from_json:
            source = input("YouTube-Link oder Videodatei: ").strip()
            if not source:
                log("Kein Link angegeben.")
                return 1
        out_dir = pipeline.run(source, s, from_json=args.from_json)
        if args.open:
            open_folder(out_dir)
        return 0
    except ClipperError as exc:
        log("")
        log("FEHLER: %s" % exc)
        return 1
    except KeyboardInterrupt:
        log("")
        log("Abgebrochen.")
        return 130


if __name__ == "__main__":
    sys.exit(main())
