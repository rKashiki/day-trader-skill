"""Runs all steps: download, transcribe, pick moments, render clips, write descriptions."""

import json
import os
import time

from . import captions, download, highlights, reframe, render, transcribe
from .util import ClipperError, fmt_time, log, probe, require_tool, safe_filename, step, unique_dir

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
WORK_ROOT = os.path.join(HERE, "arbeitsordner")
OUT_ROOT = os.path.join(HERE, "clips")
FONTS_DIR = os.path.join(HERE, "assets", "fonts")
FACE_MODEL = os.path.join(HERE, "assets", "models", "face_detection_yunet_2023mar.onnx")


def run(source, settings, from_json=None):
    """Make the clips and return the output folder."""
    require_tool("ffmpeg")
    require_tool("ffprobe")
    started = time.time()
    total = 4

    previous = None
    if from_json:
        with open(from_json, encoding="utf-8") as fh:
            previous = json.load(fh)
        source = source or previous.get("source", {}).get("input")
        if not source:
            raise ClipperError("In der JSON-Datei steht keine Quelle. Gib den Link oder die Datei mit an.")
    else:
        highlights.check_credentials()

    step(1, total, "Video holen")
    video = download.fetch(source, WORK_ROOT, settings.download.max_height,
                           settings.download.cookies_from_browser)
    info = probe(video["path"])
    log("  %dx%d, %.2f fps, %s" % (info["width"], info["height"], float(info["fps"]),
                                   fmt_time(info["duration"])))
    if not info["has_audio"]:
        raise ClipperError("Das Video hat keine Tonspur. Ohne Sprache kann die KI keine Momente finden.")

    step(2, total, "Sprache erkennen (Transkription)")
    transcript = transcribe.transcribe(video["path"], video["work_dir"], settings.transcription)
    transcript.setdefault("duration", info["duration"])

    step(3, total, "Beste Momente finden")
    if previous:
        clips = [_clamp(c, info["duration"]) for c in previous.get("clips", [])]
        clips = [c for c in clips if c]
        log("  %d Clips aus %s übernommen (ohne KI)." % (len(clips), os.path.basename(from_json)))
        out_dir = os.path.dirname(os.path.abspath(from_json))
    else:
        clips = highlights.pick(video, transcript, settings.clips, settings.ai)
        out_dir = unique_dir(os.path.join(OUT_ROOT, safe_filename(video["title"], 70, "video")))
    if not clips:
        raise ClipperError("Keine Clips zum Rendern.")
    for n, c in enumerate(clips, 1):
        log("  %d. [%s-%s] %s  (Score %s)" % (n, fmt_time(c["start"]), fmt_time(c["end"]),
                                               c["title"], c.get("score", "-")))

    step(4, total, "Clips schneiden (9:16, Untertitel)")
    os.makedirs(out_dir, exist_ok=True)
    layout = settings.clips.layout
    W, H = int(settings.video.width), int(settings.video.height)
    for n, c in enumerate(clips, 1):
        label = "Clip %d/%d" % (n, len(clips))
        c["file"] = "%02d - %s.mp4" % (n, safe_filename(c["title"], 60, "Clip"))
        log("  %s: %s" % (label, c["title"]))
        plan = reframe.analyze(video["path"], c["start"], c["end"] - c["start"], info["fps"],
                               info["width"], info["height"], W, H, layout, FACE_MODEL)
        log("    Bild: %s" % plan.summary())
        ass = None
        if settings.captions.enabled:
            ass = captions.build_ass(transcript["words"], c["start"], c["end"], settings.captions, W, H)
        encoder = render.render(video["path"], info, c["start"], c["end"], plan, ass,
                                os.path.join(out_dir, c["file"]), settings.video, FONTS_DIR,
                                os.path.join(video["work_dir"], "render"), label)
    log("  (Encoder: %s)" % ("Nvidia NVENC" if encoder == "nvenc" else "x264 auf dem Prozessor"))

    _write_outputs(out_dir, video, source, clips)
    log("")
    log("Fertig in %s! %s hier:" % (fmt_time(time.time() - started),
                                     "1 Clip liegt" if len(clips) == 1 else "%d Clips liegen" % len(clips)))
    log("  %s" % out_dir)
    return out_dir


def _clamp(c, duration):
    try:
        s, e = max(0.0, float(c["start"])), min(duration, float(c["end"]))
    except (KeyError, TypeError, ValueError):
        return None
    if e - s < 1:
        return None
    c = dict(c)
    c["start"], c["end"] = s, e
    c.setdefault("title", "Clip")
    return c


def _write_outputs(out_dir, video, source, clips):
    data = {
        "source": {"input": source, "title": video["title"], "url": video.get("url")},
        "clips": [{k: c.get(k) for k in ("file", "start", "end", "title", "hook", "description",
                                         "hashtags", "score", "reason")} for c in clips],
    }
    with open(os.path.join(out_dir, "clips.json"), "w", encoding="utf-8") as fh:
        json.dump(data, fh, ensure_ascii=False, indent=2)

    lines = ["# %s" % video["title"], ""]
    if video.get("url"):
        lines += ["Quelle: %s" % video["url"], ""]
    for n, c in enumerate(clips, 1):
        tags = " ".join("#" + h for h in (c.get("hashtags") or []))
        lines += [
            "## %d. %s" % (n, c["title"]),
            "",
            "- Datei: %s" % c.get("file", ""),
            "- Stelle im Original: %s bis %s (%d Sekunden)" % (
                fmt_time(c["start"]), fmt_time(c["end"]), round(c["end"] - c["start"])),
            "- Score: %s/100" % c.get("score", "-"),
        ]
        if c.get("reason"):
            lines.append("- Warum: %s" % c["reason"])
        lines += ["", "Beschreibung zum Kopieren:", "", "```", "%s\n\n%s" % (
            c.get("description") or c["title"], tags), "```", ""]
    with open(os.path.join(out_dir, "Beschreibungen.md"), "w", encoding="utf-8") as fh:
        fh.write("\n".join(lines))
