"""Read settings.toml, fill in defaults and check the values."""

import copy
import os
import re

try:
    import tomllib
except ImportError:  # Python < 3.11
    tomllib = None

from .util import ClipperError

DEFAULTS = {
    "clips": {"count": 5, "min_seconds": 20, "max_seconds": 60, "layout": "auto", "focus": ""},
    "ai": {"model": "claude-opus-5-5", "effort": "high", "output_language": ""},
    "transcription": {"model": "large-v3-turbo", "language": "", "device": "auto"},
    "captions": {
        "enabled": True, "font": "Montserrat Black", "size": 92, "color": "#FFFFFF",
        "highlight_color": "#FFE11A", "outline_color": "#000000", "outline": 7, "shadow": 3,
        "max_words": 3, "max_chars": 18, "position": 0.70, "uppercase": True,
        "remove_punctuation": True,
    },
    "video": {"width": 1080, "height": 1920, "encoder": "auto", "quality": 20},
    "download": {"max_height": 1080, "cookies_from_browser": ""},
}

LAYOUTS = ("auto", "crop", "fit")
EFFORTS = ("low", "medium", "high", "xhigh", "max")
DEVICES = ("auto", "cuda", "cpu")
ENCODERS = ("auto", "nvenc", "x264")


class Section(dict):
    """A dict whose keys can also be read as attributes (settings.clips.count)."""

    def __getattr__(self, name):
        try:
            return self[name]
        except KeyError:
            raise AttributeError(name)

    def __setattr__(self, name, value):
        self[name] = value


def load(path):
    data = copy.deepcopy(DEFAULTS)
    if path and os.path.exists(path):
        if tomllib is None:
            raise ClipperError("Bitte Python 3.11 oder neuer verwenden (empfohlen: 3.12).")
        with open(path, "rb") as fh:
            try:
                user = tomllib.load(fh)
            except tomllib.TOMLDecodeError as exc:
                raise ClipperError("settings.toml enthält einen Fehler: %s" % exc)
        for section, values in user.items():
            if section in data and isinstance(values, dict):
                for key, value in values.items():
                    if key in data[section]:
                        data[section][key] = value
    settings = Section({name: Section(values) for name, values in data.items()})
    validate(settings)
    return settings


def validate(s):
    c = s.clips
    if c.layout not in LAYOUTS:
        raise ClipperError("layout muss einer von %s sein, nicht '%s'." % (", ".join(LAYOUTS), c.layout))
    if not (1 <= int(c.count) <= 30):
        raise ClipperError("Die Anzahl der Clips muss zwischen 1 und 30 liegen.")
    if not (5 <= float(c.min_seconds) < float(c.max_seconds) <= 600):
        raise ClipperError("min_seconds muss kleiner als max_seconds sein (5 bis 600 Sekunden).")
    if s.ai.effort not in EFFORTS:
        raise ClipperError("effort muss einer von %s sein." % ", ".join(EFFORTS))
    if s.transcription.device not in DEVICES:
        raise ClipperError("device muss einer von %s sein." % ", ".join(DEVICES))
    if s.video.encoder not in ENCODERS:
        raise ClipperError("encoder muss einer von %s sein." % ", ".join(ENCODERS))
    for key in ("color", "highlight_color", "outline_color"):
        if not re.fullmatch(r"#?[0-9A-Fa-f]{6}", str(s.captions[key])):
            raise ClipperError("%s muss eine Farbe wie \"#FFE11A\" sein." % key)
    if not (0.05 <= float(s.captions.position) <= 0.95):
        raise ClipperError("captions.position muss zwischen 0.05 und 0.95 liegen.")
    if int(s.video.width) % 2 or int(s.video.height) % 2:
        raise ClipperError("video.width und video.height müssen gerade Zahlen sein.")
