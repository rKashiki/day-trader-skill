"""Voiceover + Wort-Timeline aus script.json erzeugen (Kokoro TTS, lokal).

Aufruf:  python3 engine/tts.py videos/<slug>
         (startet sich automatisch mit .venv-tts/bin/python neu, dort ist Kokoro installiert)

Liest   videos/<slug>/script.json
Schreibt videos/<slug>/build/voice.wav      (24 kHz mono)
         videos/<slug>/build/timeline.json  (Beats + Wörter mit Start/Ende in Sekunden)

Standardstimme für alle englischen Videos: am_fenrir (männlich, US-Englisch, energisch).
Jeder Beat wird einzeln synthetisiert und gecacht, damit Szenen exakt auf Satzgrenzen schneiden können.
"""
import hashlib
import json
import os
import re
import sys
import wave

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
VENV_PY = os.path.join(ROOT, ".venv-tts", "bin", "python")

try:
    import numpy as np
    from kokoro import KPipeline
except ImportError:
    if os.path.exists(VENV_PY) and os.path.realpath(sys.executable) != os.path.realpath(VENV_PY):
        os.execv(VENV_PY, [VENV_PY, *sys.argv])
    sys.exit("Kokoro fehlt. Setup siehe README (uv venv .venv-tts + kokoro).")

SR = 24000
DEFAULT_VOICE = "am_fenrir"
PUNCT = re.compile(r"^[^\w]+$", re.UNICODE)
_PIPES = {}


def pipeline(lang):
    if lang not in _PIPES:
        _PIPES[lang] = KPipeline(lang_code=lang, repo_id="hexgrad/Kokoro-82M")
    return _PIPES[lang]


def synth(text, voice, speed, lang):
    """Gibt (audio float32 @24k, [ {w,start,end} ]) zurück. Kokoro liefert Zeitstempel pro Token."""
    audio, words, offset = [], [], 0.0
    for r in pipeline(lang)(text, voice=voice, speed=speed):
        a = r.audio.numpy() if hasattr(r.audio, "numpy") else np.asarray(r.audio)
        a = a.astype(np.float32)
        for tok in r.tokens or []:
            if PUNCT.match(tok.text or ""):
                continue
            s, e = tok.start_ts, tok.end_ts
            words.append({"w": tok.text, "start": None if s is None else offset + s, "end": None if e is None else offset + e})
        audio.append(a)
        offset += len(a) / SR
    # fehlende Zeitstempel (selten) linear auffüllen
    for i, w in enumerate(words):
        if w["start"] is None:
            w["start"] = words[i - 1]["end"] if i else 0.0
        if w["end"] is None:
            nxt = next((x["start"] for x in words[i + 1:] if x["start"] is not None), offset)
            w["end"] = max(w["start"] + 0.05, nxt)
    return np.concatenate(audio) if audio else np.zeros(1, np.float32), words


def main(video_dir):
    script = json.load(open(os.path.join(video_dir, "script.json"), encoding="utf-8"))
    build = os.path.join(video_dir, "build")
    cache = os.path.join(build, "tts-cache")
    os.makedirs(cache, exist_ok=True)

    voice = script.get("voice", DEFAULT_VOICE)
    speed = float(script.get("speed", 1.0))
    lang = script.get("lang", "a")  # a = amerikanisches Englisch
    lead_in = float(script.get("lead_in", 0.15))
    tail = float(script.get("tail", 1.2))
    default_pause = float(script.get("pause", 0.12))

    pieces = [np.zeros(int(lead_in * SR), np.float32)]
    t = lead_in
    beats_out = []
    for beat in script["beats"]:
        text = beat["text"]
        b_voice = beat.get("voice", voice)
        b_speed = float(beat.get("speed", speed))
        key = hashlib.sha1(f"kokoro|{text}|{b_voice}|{b_speed}|{lang}".encode()).hexdigest()[:16]
        wav_p, json_p = os.path.join(cache, key + ".npy"), os.path.join(cache, key + ".json")
        if os.path.exists(wav_p) and os.path.exists(json_p):
            audio, words = np.load(wav_p), json.load(open(json_p, encoding="utf-8"))
        else:
            audio, words = synth(text, b_voice, b_speed, lang)
            np.save(wav_p, audio)
            json.dump(words, open(json_p, "w", encoding="utf-8"), ensure_ascii=False)

        # Lange Pausen innerhalb eines Beats kürzen (Shorts brauchen Tempo).
        max_gap = float(beat.get("max_gap", script.get("max_gap", 0.30)))
        cuts = []
        for a, b in zip(words, words[1:]):
            if b["start"] - a["end"] > max_gap:
                cuts.append((a["end"] + max_gap * 0.6, b["start"] - max_gap * 0.4))

        def remap(x):
            return x - sum(min(c1, x) - c0 for c0, c1 in cuts if x > c0)

        keep, pos = [], 0.0
        for c0, c1 in cuts:
            keep.append(audio[int(pos * SR):int(c0 * SR)])
            pos = c1
        keep.append(audio[int(pos * SR):])
        audio = np.concatenate(keep)
        words = [{**w, "start": remap(w["start"]), "end": remap(w["end"])} for w in words]

        # Stille vorne/hinten abschneiden.
        head = max(0.0, (words[0]["start"] if words else 0) - 0.04)
        last = (words[-1]["end"] if words else len(audio) / SR) + 0.10
        audio = audio[int(head * SR):min(len(audio), int(last * SR))]
        dur = len(audio) / SR

        beats_out.append({
            "id": beat["id"], "text": text,
            "start": round(t, 3), "end": round(t + dur, 3),
            "words": [{"w": w["w"], "start": round(t + w["start"] - head, 3), "end": round(t + w["end"] - head, 3)} for w in words],
            **{k: v for k, v in beat.items() if k not in ("id", "text", "voice", "speed")},
        })
        pause = float(beat.get("pause", default_pause))
        pieces += [audio, np.zeros(int(pause * SR), np.float32)]
        t += dur + pause

    pieces.append(np.zeros(int(tail * SR), np.float32))
    full = np.concatenate(pieces)
    duration = len(full) / SR
    with wave.open(os.path.join(build, "voice.wav"), "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes((np.clip(full, -1, 1) * 32767).astype(np.int16).tobytes())

    timeline = {"duration": round(duration, 3), "voice": voice, "beats": beats_out}
    json.dump(timeline, open(os.path.join(build, "timeline.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print(f"voice.wav {duration:.2f}s ({voice}, speed {speed}), {len(beats_out)} beats, {sum(len(b['words']) for b in beats_out)} words")
    for b in beats_out:
        print(f"  {b['start']:6.2f}-{b['end']:6.2f}  {b['id']:<5} {b['text'][:72]}")


if __name__ == "__main__":
    main(sys.argv[1])
