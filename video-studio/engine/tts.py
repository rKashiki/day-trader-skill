"""Voiceover + Wort-Timeline aus script.json erzeugen.

Aufruf:  python3 engine/tts.py videos/<slug>

Liest   videos/<slug>/script.json
Schreibt videos/<slug>/build/voice.wav      (48 kHz mono)
         videos/<slug>/build/timeline.json  (Beats + Wörter mit Start/Ende in Sekunden)

Jeder Beat wird einzeln synthetisiert (gecacht über Hash), damit die Szenen
exakt auf Satzgrenzen schneiden können.
"""
import asyncio
import hashlib
import json
import os
import subprocess
import sys
import wave

import numpy as np

# Der Agent-Proxy terminiert TLS neu; edge-tts nutzt certifi direkt.
CA = "/root/.ccr/ca-bundle.crt"
if os.path.exists(CA):
    import certifi
    certifi.where = lambda: CA

import edge_tts  # noqa: E402

SR = 48000


def decode(mp3_path):
    raw = subprocess.run(
        ["ffmpeg", "-nostdin", "-v", "error", "-i", mp3_path, "-f", "s16le", "-ac", "1", "-ar", str(SR), "-"],
        check=True, capture_output=True,
    ).stdout
    return np.frombuffer(raw, dtype=np.int16).astype(np.float32) / 32768.0


async def synth(text, voice, rate, pitch, mp3_path):
    com = edge_tts.Communicate(text, voice, rate=rate, pitch=pitch, boundary="WordBoundary")
    audio = bytearray()
    words = []
    async for chunk in com.stream():
        if chunk["type"] == "audio":
            audio.extend(chunk["data"])
        elif chunk["type"] == "WordBoundary":
            words.append({
                "w": chunk["text"],
                "start": chunk["offset"] / 1e7,
                "end": (chunk["offset"] + chunk["duration"]) / 1e7,
            })
    with open(mp3_path, "wb") as f:
        f.write(audio)
    return words


def main(video_dir):
    script = json.load(open(os.path.join(video_dir, "script.json"), encoding="utf-8"))
    build = os.path.join(video_dir, "build")
    cache = os.path.join(build, "tts-cache")
    os.makedirs(cache, exist_ok=True)

    voice = script.get("voice", "de-DE-FlorianMultilingualNeural")
    rate = script.get("rate", "+0%")
    pitch = script.get("pitch", "+0Hz")
    lead_in = float(script.get("lead_in", 0.15))
    tail = float(script.get("tail", 1.2))
    default_pause = float(script.get("pause", 0.12))

    pieces = [np.zeros(int(lead_in * SR), np.float32)]
    t = lead_in
    beats_out = []
    for beat in script["beats"]:
        text = beat["text"]
        b_voice = beat.get("voice", voice)
        b_rate = beat.get("rate", rate)
        b_pitch = beat.get("pitch", pitch)
        key = hashlib.sha1(f"{text}|{b_voice}|{b_rate}|{b_pitch}".encode()).hexdigest()[:16]
        mp3 = os.path.join(cache, key + ".mp3")
        wj = os.path.join(cache, key + ".json")
        if not (os.path.exists(mp3) and os.path.exists(wj)):
            words = asyncio.run(synth(text, b_voice, b_rate, b_pitch, mp3))
            json.dump(words, open(wj, "w", encoding="utf-8"), ensure_ascii=False)
        words = json.load(open(wj, encoding="utf-8"))
        audio = decode(mp3)

        # Satzpausen innerhalb des Beats kürzen (TTS macht ~1 s, Shorts brauchen ~0.25 s).
        max_gap = float(beat.get("max_gap", script.get("max_gap", 0.30)))
        cuts = []
        for a, b in zip(words, words[1:]):
            gap = b["start"] - a["end"]
            if gap > max_gap:
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

        # Stille vorne/hinten abschneiden, damit das Tempo knackig bleibt.
        head = max(0.0, (words[0]["start"] if words else 0) - 0.04)
        last = (words[-1]["end"] if words else len(audio) / SR) + 0.10
        a0, a1 = int(head * SR), min(len(audio), int(last * SR))
        audio = audio[a0:a1]
        dur = len(audio) / SR

        beat_words = [{"w": w["w"], "start": round(t + w["start"] - head, 3), "end": round(t + w["end"] - head, 3)} for w in words]
        beats_out.append({
            "id": beat["id"], "text": text,
            "start": round(t, 3), "end": round(t + dur, 3),
            "words": beat_words,
            **{k: v for k, v in beat.items() if k not in ("id", "text", "voice", "rate", "pitch")},
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

    timeline = {"duration": round(duration, 3), "beats": beats_out}
    json.dump(timeline, open(os.path.join(build, "timeline.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print(f"voice.wav {duration:.2f}s, {len(beats_out)} beats, {sum(len(b['words']) for b in beats_out)} words")
    for b in beats_out:
        print(f"  {b['start']:6.2f}-{b['end']:6.2f}  {b['id']:<10} {b['text'][:70]}")


if __name__ == "__main__":
    main(sys.argv[1])
