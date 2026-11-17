"""Synthetische Sound-Effekte + Audio-Mix (Voice + SFX-Cues + optional Musik).

    python3 engine/audio.py sfx                      # SFX-Bibliothek nach assets/sfx/ erzeugen
    python3 engine/audio.py mix videos/<slug>        # build/voice.wav + build/cues.json -> build/audio.wav

cues.json kommt aus der Szene (window.getCues) und sieht so aus:
    [{"t": 1.25, "sfx": "pop", "gain": 0.6}, ...]
Optional in script.json: "music": "pfad/zur/musik.mp3", "music_gain": 0.12 (wird unter der Stimme geduckt).
"""
import json
import os
import subprocess
import sys
import wave

import numpy as np

SR = 48000
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SFX_DIR = os.path.join(ROOT, "assets", "sfx")
rng = np.random.default_rng(7)


def t_axis(sec):
    return np.arange(int(sec * SR)) / SR


def env_exp(sec, decay):
    return np.exp(-t_axis(sec) * decay)


def lowpass(x, alpha):
    y = np.empty_like(x)
    acc = 0.0
    for i, v in enumerate(x):
        acc += alpha * (v - acc)
        y[i] = acc
    return y


def band_noise(sec, lo_alpha, hi_alpha):
    n = rng.standard_normal(int(sec * SR)).astype(np.float32)
    return lowpass(n, lo_alpha) - lowpass(n, hi_alpha)


def sweep(sec, f0, f1):
    t = t_axis(sec)
    f = f0 + (f1 - f0) * t / sec
    return np.sin(2 * np.pi * np.cumsum(f) / SR)


def fade(x, fin=0.005, fout=0.02):
    x = x.copy()
    a, b = int(fin * SR), int(fout * SR)
    if a:
        x[:a] *= np.linspace(0, 1, a)
    if b:
        x[-b:] *= np.linspace(1, 0, b)
    return x


def norm(x, peak=0.9):
    m = np.max(np.abs(x)) or 1
    return (x / m * peak).astype(np.float32)


def make_sfx():
    s = {}
    # Whoosh: Rauschen mit Hüllkurve, Filter öffnet sich
    sec = 0.55
    t = t_axis(sec)
    shape = np.sin(np.pi * t / sec) ** 2
    s["whoosh"] = norm(band_noise(sec, 0.25, 0.02) * shape, 0.7)
    # Pop: kurzer Blip für Text/Label
    s["pop"] = norm(fade(sweep(0.09, 520, 980) * env_exp(0.09, 38)), 0.6)
    # Tick: Zähler / Uhr
    s["tick"] = norm(fade(np.sin(2 * np.pi * 2400 * t_axis(0.025)) * env_exp(0.025, 220), 0.0005, 0.005), 0.45)
    # Ding: Erfolg / "Das ist ein ..."
    tt = t_axis(1.1)
    ding = sum(a * np.sin(2 * np.pi * f * tt) for f, a in [(1318.5, 1), (2637, .35), (1975.5, .25)])
    s["ding"] = norm(fade(ding * env_exp(1.1, 4.5), 0.002, 0.05), 0.5)
    # Impact: tiefer Schlag für Pointe
    tt = t_axis(0.9)
    boom = np.sin(2 * np.pi * np.cumsum(90 * np.exp(-tt * 5) + 38) / SR) * env_exp(0.9, 4)
    boom += 0.35 * band_noise(0.9, 0.2, 0.01) * env_exp(0.9, 18)
    s["impact"] = norm(fade(boom, 0.001, 0.08), 0.95)
    # Riser: Spannung vor Auflösung
    sec = 1.6
    t = t_axis(sec)
    r = sweep(sec, 180, 900) * 0.4 + band_noise(sec, 0.3, 0.05) * 0.6
    s["riser"] = norm(fade(r * (t / sec) ** 2, 0.01, 0.03), 0.55)
    # Fail: dumpfer Buzz (jemand gibt auf / falsch)
    tt = t_axis(0.35)
    buzz = np.sign(np.sin(2 * np.pi * 110 * tt)) * 0.5 + np.sin(2 * np.pi * 55 * tt)
    s["fail"] = norm(fade(lowpass(buzz.astype(np.float32), 0.15) * env_exp(0.35, 6), 0.002, 0.05), 0.55)
    # Glitch: kurze digitale Störung
    g = rng.standard_normal(int(0.22 * SR)).astype(np.float32)
    g *= (np.sin(2 * np.pi * 37 * t_axis(0.22)) > 0)
    s["glitch"] = norm(fade(g, 0.001, 0.02), 0.35)
    # Heartbeat
    tt = t_axis(0.8)
    hb = np.zeros_like(tt)
    for off, a in [(0.0, 1.0), (0.22, 0.7)]:
        m = tt >= off
        hb[m] += a * np.sin(2 * np.pi * 52 * (tt[m] - off)) * np.exp(-(tt[m] - off) * 14)
    s["heartbeat"] = norm(fade(hb, 0.001, 0.05), 0.85)
    # Sizzle: Hitze / Dampf
    sz = band_noise(1.0, 0.9, 0.35) * (0.6 + 0.4 * np.sin(2 * np.pi * 9 * t_axis(1.0)))
    s["sizzle"] = norm(fade(sz, 0.05, 0.3), 0.35)
    # Pump: Kompressor-Stoß
    tt = t_axis(0.3)
    pump = np.sin(2 * np.pi * 70 * tt) * env_exp(0.3, 12) + 0.3 * band_noise(0.3, 0.3, 0.03) * env_exp(0.3, 20)
    s["pump"] = norm(fade(pump, 0.002, 0.05), 0.7)

    os.makedirs(SFX_DIR, exist_ok=True)
    for name, data in s.items():
        write_wav(os.path.join(SFX_DIR, name + ".wav"), data)
    print("SFX:", ", ".join(sorted(s)))


def write_wav(path, data):
    with wave.open(path, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes((np.clip(data, -1, 1) * 32767).astype(np.int16).tobytes())


def read_audio(path):
    raw = subprocess.run(
        ["ffmpeg", "-nostdin", "-v", "error", "-i", path, "-f", "s16le", "-ac", "1", "-ar", str(SR), "-"],
        check=True, capture_output=True,
    ).stdout
    return np.frombuffer(raw, dtype=np.int16).astype(np.float32) / 32768.0


def mix(video_dir):
    build = os.path.join(video_dir, "build")
    script = json.load(open(os.path.join(video_dir, "script.json"), encoding="utf-8"))
    voice = read_audio(os.path.join(build, "voice.wav"))
    out = voice.copy() * float(script.get("voice_gain", 1.0))
    sfx = np.zeros_like(out)
    cues_path = os.path.join(build, "cues.json")
    cues = json.load(open(cues_path)) if os.path.exists(cues_path) else []
    cache = {}
    for c in cues:
        name = c["sfx"]
        if name not in cache:
            p = os.path.join(SFX_DIR, name + ".wav")
            if not os.path.exists(p):
                print("WARN: sfx fehlt:", name)
                continue
            cache[name] = read_audio(p)
        clip = cache[name] * float(c.get("gain", 0.5)) * float(script.get("sfx_gain", 0.7))
        i = int(float(c["t"]) * SR)
        if i >= len(out):
            continue
        j = min(len(out), i + len(clip))
        sfx[i:j] += clip[: j - i]
    # Effekte leiser, solange gesprochen wird, damit die Stimme klingt wie sie ist
    env = np.convolve(np.abs(voice), np.ones(int(.05 * SR)) / int(.05 * SR), mode="same")
    talk = np.clip(env / (np.percentile(env[env > 1e-4], 60) if (env > 1e-4).any() else 1), 0, 1)
    talk = np.convolve(talk, np.ones(int(.12 * SR)) / int(.12 * SR), mode="same")
    out += sfx * (1 - float(script.get("sfx_duck", 0.65)) * talk)

    music = script.get("music")
    if music:
        mpath = music if os.path.isabs(music) else os.path.join(video_dir, music)
        m = read_audio(mpath)
        reps = int(np.ceil(len(out) / len(m)))
        m = np.tile(m, reps)[: len(out)] * float(script.get("music_gain", 0.12))
        # Ducking: Musik leiser, wenn gesprochen wird
        envl = np.abs(voice)
        win = int(0.15 * SR)
        envl = np.convolve(envl, np.ones(win) / win, mode="same")
        duck = 1 - 0.6 * np.clip(envl / (envl.max() or 1) * 6, 0, 1)
        out += m * duck

    peak = np.max(np.abs(out)) or 1
    out = out / peak * 0.89  # ca. -1 dBFS
    write_wav(os.path.join(build, "audio.wav"), out)
    print(f"audio.wav {len(out)/SR:.2f}s, {len(cues)} SFX-Cues")


if __name__ == "__main__":
    if sys.argv[1] == "sfx":
        make_sfx()
    elif sys.argv[1] == "mix":
        mix(sys.argv[2])
