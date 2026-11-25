"""Step 2: speech to text with word timestamps (faster-whisper, runs locally)."""

import glob
import json
import os
import sys
import time

from .util import ClipperError, fmt_time, log, run

SENTENCE_END = (".", "?", "!", "…", "。", "？", "！")


def transcribe(video_path, work_dir, cfg):
    """Return {"language", "model", "words": [{"w", "s", "e"}]}; cached per video and model."""
    cache = os.path.join(work_dir, "transcript.json")
    if os.path.exists(cache):
        with open(cache, encoding="utf-8") as fh:
            data = json.load(fh)
        if data.get("model") == cfg.model and data.get("words") and \
                (not cfg.language or cfg.language == data.get("language")):
            log("  Transkript schon vorhanden (%d Wörter), verwende es erneut." % len(data["words"]))
            return data

    os.environ.setdefault("HF_HUB_DISABLE_SYMLINKS_WARNING", "1")
    os.environ.setdefault("HF_HUB_VERBOSITY", "error")
    _add_cuda_dlls()
    try:
        import faster_whisper  # noqa: F401
    except ImportError:
        raise ClipperError("faster-whisper fehlt. Bitte setup_windows.bat erneut ausführen.")

    device = cfg.device
    if device == "auto":
        device = "cuda" if _cuda_available() else "cpu"
    try:
        data = _run(video_path, cfg.model, device, cfg.language)
    except Exception as exc:
        if device == "cuda" and _is_cuda_problem(exc):
            log("")
            log("  Die Grafikkarte konnte nicht genutzt werden (%s)." % str(exc).splitlines()[0])
            log("  Ich mache auf dem Prozessor weiter, das dauert länger. Lösung siehe README, Abschnitt 'Grafikkarte'.")
            data = _run(video_path, cfg.model, "cpu", cfg.language)
        else:
            raise
    if not data["words"]:
        raise ClipperError("Im Video wurde keine Sprache erkannt. Clips brauchen gesprochenen Text.")
    with open(cache, "w", encoding="utf-8") as fh:
        json.dump(data, fh, ensure_ascii=False)
    return data


def _run(video_path, model_name, device, language):
    from faster_whisper import WhisperModel

    compute_type = "float16" if device == "cuda" else "int8"
    log("  Lade Whisper-Modell '%s' auf %s (beim ersten Mal wird es heruntergeladen) ..."
        % (model_name, "Grafikkarte" if device == "cuda" else "Prozessor"))
    model = WhisperModel(model_name, device=device, compute_type=compute_type)
    started = time.time()
    segments, info = model.transcribe(
        load_audio(video_path),
        language=language or None,
        word_timestamps=True,
        vad_filter=True,
        vad_parameters={"min_silence_duration_ms": 500},
        beam_size=5,
        condition_on_previous_text=False,
    )
    log("  Sprache: %s (%.0f %%), Audio: %s" % (info.language, info.language_probability * 100,
                                                fmt_time(info.duration)))
    words = []
    last_pct = -1
    for seg in segments:
        for w in seg.words or []:
            text = w.word.strip()
            if not text:
                continue
            start = max(float(w.start), words[-1]["e"] if words else 0.0)
            end = max(float(w.end), start + 0.01)
            words.append({"w": text, "s": round(start, 3), "e": round(end, 3)})
        if info.duration:
            pct = int(min(seg.end / info.duration, 1.0) * 100)
            if pct >= last_pct + 5:
                last_pct = pct
                sys.stdout.write("\r  Transkription: %3d %%" % pct)
                sys.stdout.flush()
    sys.stdout.write("\r  Transkription: 100 %% (%d Wörter in %s)\n" % (len(words), fmt_time(time.time() - started)))
    sys.stdout.flush()
    return {"language": info.language, "model": model_name, "duration": info.duration, "words": words}


def load_audio(path):
    """Audio as 16 kHz mono float32, decoded by ffmpeg (avoids PyAV version problems)."""
    import numpy as np
    raw = run(["ffmpeg", "-v", "error", "-i", path, "-vn", "-sn", "-ac", "1", "-ar", "16000",
               "-f", "f32le", "-"])
    return np.frombuffer(raw, dtype=np.float32)


def sentences(words, max_gap=1.2, max_words=40):
    """Group words into sentence-like lines with start/end times (input for the AI)."""
    out, cur = [], []
    for w in words:
        if cur and (w["s"] - cur[-1]["e"] > max_gap or len(cur) >= max_words):
            out.append(_line(cur))
            cur = []
        cur.append(w)
        if w["w"].endswith(SENTENCE_END):
            out.append(_line(cur))
            cur = []
    if cur:
        out.append(_line(cur))
    return out


def _line(ws):
    return {"s": ws[0]["s"], "e": ws[-1]["e"], "text": " ".join(x["w"] for x in ws)}


def _cuda_available():
    try:
        import ctranslate2
        return ctranslate2.get_cuda_device_count() > 0
    except Exception:
        return False


def _is_cuda_problem(exc):
    text = str(exc).lower()
    return any(k in text for k in ("cuda", "cublas", "cudnn", "dll", "out of memory", "gpu"))


def _add_cuda_dlls():
    """On Windows, the pip packages nvidia-cublas-cu12 / nvidia-cudnn-cu12 keep their DLLs in
    site-packages/nvidia/<name>/bin, which Windows does not search by itself."""
    if not sys.platform.startswith("win"):
        return
    import site
    roots = list(site.getsitepackages())
    try:
        roots.append(site.getusersitepackages())
    except Exception:
        pass
    for root in roots:
        for folder in glob.glob(os.path.join(root, "nvidia", "*", "bin")):
            try:
                os.add_dll_directory(folder)
            except (OSError, AttributeError):
                pass
            os.environ["PATH"] = folder + os.pathsep + os.environ.get("PATH", "")
