"""Voiceover + Wort-Timeline aus script.json erzeugen (Kokoro TTS, lokal).

Aufruf:  python3 engine/tts.py videos/<slug>
         (startet sich automatisch mit .venv-tts/bin/python neu, dort ist Kokoro installiert)

Liest   videos/<slug>/script.json
Schreibt videos/<slug>/build/voice.wav      (24 kHz mono)
         videos/<slug>/build/timeline.json  (Beats + Wörter mit Start/Ende in Sekunden)

Standardstimme für alle englischen Videos: am_michael (männlich, US-Englisch, ruhig und erwachsen; seit 17.11. statt am_fenrir).
Optionen in script.json: "voice": "am_michael,am_onyx" mischt Stimmen, "pitch": -3 senkt um 3 Halbtöne,
"lang": "b" für britische Stimmen (bm_*).
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
DEFAULT_VOICE = "am_michael"
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


def fade(a, ms=8):
    n = min(len(a) // 2, int(SR * ms / 1000))
    if n <= 1:
        return a
    a = a.copy()
    a[:n] *= np.linspace(0, 1, n, dtype=np.float32)
    a[-n:] *= np.linspace(1, 0, n, dtype=np.float32)
    return a


def pitch_shift(audio, semitones):
    """Tonhöhe verschieben, Dauer und Formanten bleiben erhalten (ffmpeg + rubberband)."""
    import subprocess
    f = 2 ** (semitones / 12)
    out = subprocess.run(
        ["ffmpeg", "-nostdin", "-v", "error", "-f", "f32le", "-ar", str(SR), "-ac", "1", "-i", "-",
         "-af", f"rubberband=pitch={f}:formant=preserved", "-f", "f32le", "-ar", str(SR), "-ac", "1", "-"],
        input=audio.astype(np.float32).tobytes(), capture_output=True, check=True).stdout
    shifted = np.frombuffer(out, dtype=np.float32)
    return shifted[:len(audio)] if len(shifted) >= len(audio) else np.pad(shifted, (0, len(audio) - len(shifted)))


def wordless(video_dir, script, build):
    """Video ohne Sprecher: stille Tonspur + Zeitmarken aus script.json ("markers": {"name": sekunden})."""
    os.makedirs(build, exist_ok=True)
    duration = float(script["duration"])
    with wave.open(os.path.join(build, "voice.wav"), "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(np.zeros(int(duration * SR), np.int16).tobytes())
    beats = [{"id": k, "text": "", "start": v, "end": v, "words": []} for k, v in sorted(script.get("markers", {}).items(), key=lambda kv: kv[1])]
    json.dump({"duration": duration, "voice": None, "beats": beats}, open(os.path.join(build, "timeline.json"), "w"), indent=1)
    print(f"wortlos: {duration:.1f}s, {len(beats)} Marker")


def _norm(s):
    return re.sub(r"[^a-z0-9]", "", s.lower())


def split_continuous(beats, audio, words):
    """Ordnet die Wörter des am Stück gesprochenen Textes den Beats zu und schneidet das Audio passend.
    Gibt [(audio_beat, words_relativ), ...] zurück oder None, wenn die Zuordnung nicht aufgeht."""
    toks = [w for w in words if _norm(w["w"])]
    pos, ranges = 0, []
    for b in beats:
        expected = [_norm(x) for x in re.findall(r"[\w'’]+", b["text"]) if _norm(x)]
        idx = []
        for e in expected:
            j = next((k for k in range(pos, min(pos + 3, len(toks))) if _norm(toks[k]["w"]) == e), None)
            if j is None:
                return None
            idx.append(j)
            pos = j + 1
        if not idx:
            return None
        ranges.append((idx[0], idx[-1]))
    out = []
    for i, (a, z) in enumerate(ranges):
        s = toks[a]["start"] - .05
        if i:
            s = max(s, toks[ranges[i - 1][1]]["end"] + .01)
        e = toks[z]["end"] + .12
        if i + 1 < len(ranges):
            e = min(e, toks[ranges[i + 1][0]]["start"] - .02)
        seg = audio[int(max(0, s) * SR):int(e * SR)]
        ws = [{"w": w["w"], "start": w["start"] - max(0, s), "end": w["end"] - max(0, s)} for w in toks[a:z + 1]]
        out.append((seg, ws))
    return out


def main(video_dir):
    script = json.load(open(os.path.join(video_dir, "script.json"), encoding="utf-8"))
    build = os.path.join(video_dir, "build")
    if script.get("wordless"):
        return wordless(video_dir, script, build)
    cache = os.path.join(build, "tts-cache")
    os.makedirs(cache, exist_ok=True)

    voice = script.get("voice", DEFAULT_VOICE)
    speed = float(script.get("speed", 1.0))
    lang = script.get("lang", "a")  # a = amerikanisches Englisch, b = britisch
    pitch = float(script.get("pitch", 0))  # Halbtöne, z. B. -3 = tiefer
    lead_in = float(script.get("lead_in", 0.15))
    tail = float(script.get("tail", 1.2))
    default_pause = float(script.get("pause", 0.12))

    def cached(text, v, sp):
        key = hashlib.sha1(f"kokoro|{text}|{v}|{sp}|{lang}".encode()).hexdigest()[:16]
        wav_p, json_p = os.path.join(cache, key + ".npy"), os.path.join(cache, key + ".json")
        if os.path.exists(wav_p) and os.path.exists(json_p):
            return np.load(wav_p), json.load(open(json_p, encoding="utf-8"))
        a, ws = synth(text, v, sp, lang)
        np.save(wav_p, a)
        json.dump(ws, open(json_p, "w", encoding="utf-8"), ensure_ascii=False)
        return a, ws

    # Standard: ganzen Text AM STÜCK sprechen lassen (natürlicher Sprachfluss wie in einer Hörprobe)
    # und danach anhand der Wort-Zeitstempel in die Beats schneiden. Fällt auf Einzelsätze zurück,
    # wenn Beats eigene Stimmen/Tempi haben oder die Zuordnung nicht aufgeht.
    segments = None
    overrides = any("voice" in b or "speed" in b for b in script["beats"])
    if script.get("continuous", True) and not overrides:
        segments = split_continuous(script["beats"], *cached(" ".join(b["text"] for b in script["beats"]), voice, speed))
        if segments is None:
            print("Hinweis: Wort-Zuordnung nicht eindeutig, nutze Einzelsätze")
    if segments is None:
        segments = [cached(b["text"], b.get("voice", voice), float(b.get("speed", speed))) for b in script["beats"]]

    pieces = [np.zeros(int(lead_in * SR), np.float32)]
    t = lead_in
    beats_out = []
    for beat, (audio, words) in zip(script["beats"], segments):
        text = beat["text"]
        if pitch:
            audio = pitch_shift(audio, pitch)

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
        audio = np.concatenate([fade(k) for k in keep])  # 8-ms-Blenden: keine Klicks an Schnitten
        words = [{**w, "start": remap(w["start"]), "end": remap(w["end"])} for w in words]

        # Stille vorne/hinten abschneiden.
        head = max(0.0, (words[0]["start"] if words else 0) - 0.04)
        last = (words[-1]["end"] if words else len(audio) / SR) + 0.10
        audio = fade(audio[int(head * SR):min(len(audio), int(last * SR))])
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
    print(f"voice.wav {duration:.2f}s ({voice}, speed {speed}, pitch {pitch:+g}), {len(beats_out)} beats, {sum(len(b['words']) for b in beats_out)} words")
    for b in beats_out:
        print(f"  {b['start']:6.2f}-{b['end']:6.2f}  {b['id']:<5} {b['text'][:72]}")


if __name__ == "__main__":
    main(sys.argv[1])
