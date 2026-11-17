# Video-Studio (Load & Limit + Motivation)

Kurzvideos auf **Englisch** (1080×1920, 30 fps), komplett aus Code: KI-Stimme, animierte Grafik im Browser,
Wort-für-Wort-Captions, Sound-Effekte, fertiges MP4. Gebaut, damit du neue Videos einfach mit Claude Code erzeugst.

**Stimme für alle Videos: Kokoro, `am_fenrir`** (männlich, US-Englisch, energisch). Läuft lokal, ohne Account,
Modell unter Apache-2.0-Lizenz.

- `ANALYSE.md` – was die Referenzvideos stark macht (Hooks, Aufbau, Artwork) + Hook-Formeln
- `CONTENT-PLAN.md` – fertige Video-Ideen mit englischen Hooks für beide Accounts + Posting-Checkliste
- `videos/ll-001-fridge/` – Pilot Load & Limit (66 s)
- `videos/mo-001-habit/` – Pilot Motivation (52 s)

## So entsteht ein Video

```
videos/<slug>/script.json   Text in Beats (Sätze/Absätze), Stimme am_fenrir
        │  python3 engine/tts.py videos/<slug>       (Kokoro, lokal)
        ▼
build/voice.wav + build/timeline.json   (jedes Wort mit Start/Ende in Sekunden)
        │  scene.js zeichnet jeden Frame anhand dieser Zeiten
        ▼  node engine/render.mjs videos/<slug>
out/<slug>.mp4               (Bild + Stimme + Effekte, lautheitsnormalisiert)
```

Alle Animationen hängen an Wort-Zeitstempeln (`wt('b7', 'evaporator')`). Wenn du den Text änderst,
wandern die Animationen automatisch mit.

## Einmaliges Setup

```bash
cd video-studio
# Kokoro braucht Python 3.12 (unter 3.13 lassen sich seine Abhängigkeiten nicht bauen)
uv venv -p python3.12 .venv-tts
uv pip install -p .venv-tts/bin/python --index-strategy unsafe-best-match \
  --extra-index-url https://download.pytorch.org/whl/cpu torch "kokoro>=0.9.4" soundfile
uv pip install -p .venv-tts/bin/python \
  "en_core_web_sm @ https://github.com/explosion/spacy-models/releases/download/en_core_web_sm-3.8.0/en_core_web_sm-3.8.0-py3-none-any.whl"

npm install                         # holt die Schrift Anton
cp node_modules/@fontsource/anton/files/anton-latin-400-normal.woff2 assets/fonts/anton.woff2
python3 engine/audio.py sfx         # erzeugt die Sound-Effekte (braucht numpy)
```

Playwright/Chromium und ffmpeg müssen vorhanden sein (in der Cloud-Umgebung vorinstalliert).
Kokoro lädt Modell und Stimme beim ersten Lauf von Hugging Face (`hexgrad/Kokoro-82M`).

## Befehle

```bash
python3 engine/tts.py videos/<slug>                    # Stimme + Timeline (wechselt automatisch in .venv-tts)
node engine/render.mjs videos/<slug> --sheet 24        # Kontaktbogen zur Kontrolle (3 s)
node engine/render.mjs videos/<slug> --stills 0,12.5   # einzelne Standbilder
node engine/render.mjs videos/<slug>                   # fertiges Video (~1 min)
node engine/render.mjs videos/<slug> --mux             # nur Ton neu mischen
```

## Neues Video mit Claude Code

Beispiel-Prompt:

> Create `videos/ll-002-bottle` from idea 002 in CONTENT-PLAN.md. Same look as ll-001
> (blueprint style, same header). Show me the script first, then render.

Claude legt `script.json` + `scene.js` an (die beiden Piloten dienen als Vorlage), prüft per Kontaktbogen und rendert.

## script.json

```jsonc
{
  "voice": "am_fenrir",    // Standard für alle Videos
  "speed": 1.08,           // Sprechtempo (1.0 = normal)
  "max_gap": 0.30,         // längste Pause innerhalb eines Beats
  "pause": 0.12,           // Pause zwischen Beats
  "sfx_gain": 0.7,         // Lautstärke aller Effekte
  "music": "music.mp3",    // optional, wird unter der Stimme automatisch leiser
  "beats": [ { "id": "h1", "text": "Your fridge makes your kitchen hotter.", "pause": 0.25 } ]
}
```

Schreibtipps für Kokoro: Zahlen als Ziffern ("Day 66" → Caption zeigt „66"), keine Dezimalzahlen im
gesprochenen Text, kurze Sätze. Sound-Effekte nie genau auf ein Schlüsselwort legen, sonst wird es überdeckt.

## Kit (engine/lib.js)

| Funktion | Zweck |
|----------|-------|
| `wt(beat, word)`, `bs(beat)`, `be(beat)` | Zeitpunkt eines Wortes / Beat-Start / Beat-Ende |
| `ease(t, start, dauer, E.outBack)` | Animation 0→1 mit Easing |
| `captions(t, {accentWords, accents, display})` | Wort-für-Wort-Untertitel mit Akzentfarben |
| `path()`, `strokePath()`, `pointAt()` | Linien, die sich zeichnen; Partikel entlang von Rohren |
| `arrow()`, `txt()`, `tag()`, `bubble()`, `battery()`, `drawFace()` | Grafik-Bausteine |
| `cue(t, 'whoosh', 0.5)` | Sound-Effekt (whoosh, pop, tick, ding, impact, riser, fail, glitch, heartbeat, sizzle, pump) |

## Stil-Kits

Neben dem Basis-Kit gibt es zwei Look-Kits, die eine Szene zusätzlich in `scene.html` lädt:

| Kit | Look | Beispiel |
|-----|------|----------|
| `engine/kit-spotlight.js` | monochrom, leuchtende Figuren, Lichtkegel, Filmkorn, Pill-Labels, große Zähler, weiche Szenen-Überblendungen (`runScenes`) | `videos/mo-003-overnight` |
| `engine/kit-hud.js` | schwarz, Linien-Icons in Ringen mit rotierender Skala, Münzen auf Punktpfaden, Diagramme | `videos/mo-004-raise` |

Beide Referenz-Stile kommen ohne Wort-Untertitel aus; in den Szenen schaltet `CAPTIONS = true` dezente Untertitel ein.

## Hinweise

- Temperaturen im Kühlschrank-Video sind in °F; `UNIT = 'C'` in `scene.js` schaltet auf Celsius.
- Kein Musikbett eingebaut: Trend-Sound lieber in der App ergänzen (siehe Checkliste in CONTENT-PLAN.md).
- `build/`, `out/` und `.venv-tts/` sind in `.gitignore`, weil sie jederzeit neu erzeugt werden können.
