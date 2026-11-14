# Video-Studio (Load und Limit + Motivation)

Kurzvideos (1080×1920, 30 fps) komplett aus Code: KI-Stimme, animierte Grafik im Browser, Wort-für-Wort-Captions,
Sound-Effekte, fertiges MP4. Gebaut, damit du neue Videos einfach mit Claude Code erzeugen kannst.

- `ANALYSE.md` – was die Referenzvideos stark macht (Hooks, Aufbau, Artwork) + Hook-Formeln
- `CONTENT-PLAN.md` – fertige Video-Ideen mit Hooks für beide Accounts + Posting-Checkliste
- `videos/ll-001-kuehlschrank/` – Pilot Load und Limit (65 s)
- `videos/mo-001-gewohnheit/` – Pilot Motivation (56 s)

## So entsteht ein Video

```
videos/<slug>/script.json   Text in Beats (Sätze/Absätze) + Stimme
        │  python3 engine/tts.py videos/<slug>
        ▼
build/voice.wav + build/timeline.json   (jedes Wort mit Start/Ende in Sekunden)
        │  scene.js zeichnet jeden Frame anhand dieser Zeiten
        ▼  node engine/render.mjs videos/<slug>
out/<slug>.mp4               (Bild + Stimme + Effekte, auf -14 LUFS normalisiert)
```

Alle Animationen hängen an Wort-Zeitstempeln (`wt('b7', 'Verdampfer')`). Wenn du den Text änderst,
wandern die Animationen automatisch mit.

## Befehle

```bash
cd video-studio
pip install edge-tts numpy          # einmalig (Playwright + ffmpeg sind in der Umgebung vorhanden)
npm install                         # einmalig, holt die Schrift Anton
cp node_modules/@fontsource/anton/files/anton-latin-400-normal.woff2 assets/fonts/anton.woff2
python3 engine/audio.py sfx         # einmalig, erzeugt die Sound-Effekte

python3 engine/tts.py videos/<slug>                    # Stimme + Timeline
node engine/render.mjs videos/<slug> --sheet 24        # Kontaktbogen zur Kontrolle (3 s)
node engine/render.mjs videos/<slug> --stills 0,12.5   # einzelne Standbilder
node engine/render.mjs videos/<slug>                   # fertiges Video (~1 min)
node engine/render.mjs videos/<slug> --mux             # nur Ton neu mischen
```

## Neues Video mit Claude Code

Beispiel-Prompt:

> Erstelle `videos/ll-002-flasche` nach Idee 002 aus CONTENT-PLAN.md. Format wie ll-001
> (gleicher Kopf, Blaupausen-Look). Erst Skript zeigen, dann rendern.

Claude legt `script.json` + `scene.js` an (die beiden Piloten dienen als Vorlage), prüft per Kontaktbogen und rendert.

## script.json

```jsonc
{
  "voice": "de-DE-FlorianMultilingualNeural",
  "rate": "+12%",          // Sprechtempo
  "max_gap": 0.30,         // längste Pause innerhalb eines Beats (TTS-Satzpausen werden gekürzt)
  "pause": 0.12,           // Pause zwischen Beats
  "sfx_gain": 0.7,         // Lautstärke aller Effekte
  "music": "musik.mp3",    // optional, wird unter der Stimme automatisch leiser
  "beats": [ { "id": "h1", "text": "Dein Kühlschrank macht deine Küche wärmer.", "pause": 0.25 } ]
}
```

Deutsche Stimmen (edge-tts): `de-DE-FlorianMultilingualNeural` (Load und Limit), `de-DE-ConradNeural` (Motivation),
`de-DE-KillianNeural`, `de-DE-SeraphinaMultilingualNeural` (weiblich), `de-DE-KatjaNeural` (weiblich).

## Kit (engine/lib.js)

| Funktion | Zweck |
|----------|-------|
| `wt(beat, wort)`, `bs(beat)`, `be(beat)` | Zeitpunkt eines Wortes / Beat-Start / Beat-Ende |
| `ease(t, start, dauer, E.outBack)` | Animation 0→1 mit Easing |
| `captions(t, {accentWords, accents, display})` | Wort-für-Wort-Untertitel mit Akzentfarben, Zahlwort→Ziffern |
| `path()`, `strokePath()`, `pointAt()` | Linien, die sich zeichnen; Partikel entlang von Rohren |
| `arrow()`, `txt()`, `tag()`, `bubble()`, `battery()`, `drawFace()` | Grafik-Bausteine |
| `cue(t, 'whoosh', 0.5)` | Sound-Effekt (whoosh, pop, tick, ding, impact, riser, fail, glitch, heartbeat, sizzle, pump) |

## Hinweise

- Die Stimme kommt von Microsofts Edge-Vorlesedienst (online, kostenlos, ohne Account). Vor kommerzieller Nutzung
  die Nutzungsbedingungen prüfen; alternativ eine Stimme mit klarer Lizenz einsetzen (z. B. ElevenLabs).
- Kein Musikbett eingebaut: Trend-Sound lieber in der App ergänzen (siehe Checkliste in CONTENT-PLAN.md).
- `build/` und `out/` sind in `.gitignore`, weil sie jederzeit neu erzeugt werden können.
