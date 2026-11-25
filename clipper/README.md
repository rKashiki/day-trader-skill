# Clipper

Dein eigenes Clipping-Tool, ähnlich wie Opus Clip, Klap oder Submagic, aber lokal auf deinem PC:
YouTube-Link (oder Videodatei) rein, fertige Hochformat-Clips mit animierten Untertiteln raus.

Was passiert, wenn du einen Link eingibst:

1. **Download**: `yt-dlp` lädt das Video (bis 1080p).
2. **Transkription**: Whisper (`faster-whisper`) schreibt mit, was gesagt wird, mit Zeitstempel für jedes Wort.
   Läuft komplett auf deinem PC, mit Nvidia-Grafikkarte sehr schnell.
3. **Beste Momente**: Claude liest das Transkript und sucht die stärksten 20 bis 60 Sekunden langen
   Abschnitte heraus: starker Einstieg, verständlich ohne Kontext, mit Pointe. Dazu gibt es Titel,
   Beschreibung, Hashtags und eine Bewertung (0 bis 100).
4. **9:16-Zuschnitt**: Eine Gesichtserkennung hält den Sprecher im Bild. Bei zwei Personen im Bild
   wird auf die Person geschnitten, deren Mund sich bewegt (Sprecherwechsel). Ohne Gesicht
   (Bildschirmaufnahme, Totale) wird das ganze Bild mit unscharfem Hintergrund gezeigt.
5. **Untertitel**: Wort für Wort, das gesprochene Wort leuchtet gelb auf, direkt ins Video gebrannt.
6. **Export**: fertige MP4-Dateien (1080x1920) plus eine Datei mit allen Beschreibungen zum Kopieren.

## Einrichtung (Windows, einmalig)

1. Diesen Ordner auf deinen PC holen (Repository klonen oder auf GitHub als ZIP herunterladen und entpacken).
2. Doppelklick auf **`setup_windows.bat`**. Das Skript
   - installiert Python 3.12, ffmpeg und Deno, falls sie fehlen (über `winget`),
   - legt eine eigene Python-Umgebung im Ordner `.venv` an und installiert alle Pakete,
   - installiert bei einer Nvidia-Grafikkarte die CUDA-Bibliotheken für die schnelle Transkription,
   - öffnet am Ende die Datei `.env`.
3. In `.env` deinen API-Key eintragen und speichern:
   ```
   ANTHROPIC_API_KEY=sk-ant-...
   ```
   Den Key bekommst du unter https://console.anthropic.com (Settings, API Keys). Dort lädst du auch Guthaben auf.

Wenn `setup_windows.bat` meldet, dass Python, ffmpeg oder Deno gerade installiert wurden: Fenster
schließen und das Skript noch einmal starten.

Beim allerersten Clip lädt Whisper sein Sprachmodell herunter (ca. 1,6 GB). Das passiert nur einmal.

## Clips erstellen

**Am einfachsten:** Doppelklick auf **`Clip erstellen.bat`**, YouTube-Link einfügen (Rechtsklick fügt
im Fenster ein), Enter. Am Ende öffnet sich der Ordner mit den Clips.

Eine Videodatei kannst du auch einfach mit der Maus auf `Clip erstellen.bat` ziehen.

**Über die Kommandozeile** (im Clipper-Ordner):

```
.venv\Scripts\python clip.py "https://www.youtube.com/watch?v=..."
.venv\Scripts\python clip.py "C:\Videos\podcast.mp4" --clips 8 --max 45
.venv\Scripts\python clip.py "LINK" --focus "lustige Momente" --layout fit
```

| Option | Bedeutung |
|---|---|
| `--clips 8` | Anzahl der Clips |
| `--min 15 --max 45` | Mindest- und Höchstlänge in Sekunden |
| `--focus "..."` | Wunsch an die KI, z. B. `"Tipps zum Thema Geld"` |
| `--layout auto/crop/fit` | `auto`: Sprecher verfolgen; `crop`: immer zuschneiden; `fit`: immer ganzes Bild |
| `--lang de` | Sprache festlegen statt automatisch erkennen |
| `--no-captions` | Ohne Untertitel |
| `--model claude-sonnet-5-5` | Anderes (günstigeres) Claude-Modell |
| `--from-json DATEI` | Clips aus einer bearbeiteten `clips.json` neu rendern, ohne KI |
| `--open` | Ordner am Ende öffnen |

## Was rauskommt

Im Ordner `clips\<Videotitel>\`:

- `01 - <Titel>.mp4`, `02 - ...`: die fertigen Clips, sortiert nach Bewertung
- `Beschreibungen.md`: pro Clip Titel, Stelle im Original, Begründung und eine fertige
  Beschreibung mit Hashtags zum Kopieren
- `clips.json`: alle Daten zum Nachbearbeiten (siehe unten)

Zwischendateien (Download, Transkript) liegen in `arbeitsordner\`. Wenn du dasselbe Video noch
einmal clippst, werden Download und Transkript wiederverwendet. Du kannst den Ordner jederzeit löschen.

## Clips nachbessern, ohne neu zu bezahlen

Ein Clip fängt eine Sekunde zu spät an oder ist zu lang? Öffne `clips.json` mit dem Editor, ändere
`start`/`end` (in Sekunden) oder den `title`, lösche Clips, die du nicht willst, und starte:

```
.venv\Scripts\python clip.py --from-json "clips\<Videotitel>\clips.json"
```

Das rendert nur neu und fragt die KI nicht erneut.

## Einstellungen

Alles Wichtige steht kommentiert in **`settings.toml`**: Anzahl und Länge der Clips, Layout,
KI-Modell, Whisper-Modell, Untertitel (Schrift, Größe, Farben, Position, Wörter pro Einblendung) und
Videoqualität. Datei mit dem Editor öffnen, ändern, speichern.

Eigene Schrift: `.ttf`-Datei in `assets\fonts` legen und den Schriftnamen bei `font` eintragen.

## Kosten

- Download, Transkription, Zuschnitt und Untertitel laufen lokal und kosten nichts.
- Für die Auswahl der Momente zahlt dein Anthropic-Konto pro Video. Mit dem Standardmodell
  `claude-opus-5-5` sind das grob 0,10 bis 0,40 $ pro Stunde Videomaterial (der genaue Betrag
  wird nach jedem Lauf angezeigt). Günstiger geht es mit `claude-sonnet-5-5` (etwa die Hälfte)
  oder `claude-haiku-5-5` (meist unter 1 Cent), dafür ist die Auswahl etwas weniger treffsicher.
- Lehnt ein Sicherheitsfilter die Anfrage ab, beantwortet automatisch ein Ausweichmodell sie
  (`fallbacks: "default"`), damit der Lauf nicht abbricht.

## Probleme und Lösungen

**YouTube meldet "Sign in to confirm you're not a bot"**: In `settings.toml` bei
`cookies_from_browser` `"firefox"` eintragen (in Firefox bei YouTube angemeldet sein). Chrome-Cookies
lassen sich unter Windows oft nicht auslesen. Alternativ das Video selbst herunterladen und die
Datei verwenden.

**"ffmpeg wurde nicht gefunden"**: Nach der Installation ein neues Fenster öffnen. Sonst von Hand:
`winget install Gyan.FFmpeg`.

**Die Grafikkarte wird nicht genutzt** ("Ich mache auf dem Prozessor weiter"): Nvidia-Treiber
aktualisieren und `.venv\Scripts\python -m pip install -r requirements-gpu.txt` ausführen. Es
funktioniert trotzdem, nur langsamer. Das Rendern nutzt die Grafikkarte (NVENC) unabhängig davon.

**Wörter in den Untertiteln sind falsch geschrieben**: In `settings.toml` die Sprache fest
eintragen (`language = "de"`) oder das genauere Modell `large-v3` nehmen.

**Der Zuschnitt zeigt die falsche Person oder springt**: Für diesen Clip `--layout fit` verwenden
(ganzes Bild) oder mit `--from-json` nur die Stelle neu rendern.

**Speicherplatz**: `arbeitsordner\` enthält die heruntergeladenen Videos und kann gelöscht werden.

## Wichtig: Rechte

Lade und veröffentliche nur Videos, an denen du die Rechte hast: deine eigenen, oder solche, für die
du die Erlaubnis des Creators hast (z. B. als Clipper für einen Kanal). Fremde Inhalte ohne
Erlaubnis zu clippen und hochzuladen kann zu Urheberrechtsverwarnungen führen. Die YouTube-
Nutzungsbedingungen schränken das Herunterladen ein.

## Wie es gebaut ist

```
clip.py                  Startpunkt (Kommandozeile)
settings.toml            Einstellungen
clipper_core/
  download.py            1. Video holen (yt-dlp oder lokale Datei)
  transcribe.py          2. Whisper mit Wort-Zeitstempeln, Ergebnis wird zwischengespeichert
  highlights.py          3. Claude wählt die Momente (strukturierte JSON-Antwort), Schnitte werden
                            auf Wortgrenzen gelegt
  reframe.py             4. Schnitterkennung, Gesichter (OpenCV YuNet), Sprechererkennung, Kamerafahrt
  captions.py            5. Untertitel als ASS-Datei (Wort-für-Wort-Hervorhebung)
  render.py              6. ffmpeg dekodiert, Python baut jedes 9:16-Bild, ffmpeg brennt Untertitel
                            ein und kodiert (NVENC auf Nvidia, sonst x264)
  pipeline.py            alles zusammen, schreibt Beschreibungen.md und clips.json
assets/fonts/            Montserrat Black (SIL Open Font License)
assets/models/           YuNet-Gesichtserkennung (MIT-Lizenz, aus opencv_zoo)
tests/                   python -m unittest discover tests
```

Bausteine und Ideen: [yt-dlp](https://github.com/yt-dlp/yt-dlp),
[faster-whisper](https://github.com/SYSTRAN/faster-whisper),
[OpenCV](https://github.com/opencv/opencv) mit dem YuNet-Modell aus
[opencv_zoo](https://github.com/opencv/opencv_zoo), ffmpeg mit libass. Als Vorbild für den Ablauf
dienten die Open-Source-Projekte
[AI-Youtube-Shorts-Generator](https://github.com/Anil-matcha/AI-Youtube-Shorts-Generator),
[clippyme](https://github.com/fralapo/clippyme) und
[Autocrop-vertical](https://github.com/kamilstanuch/Autocrop-vertical); Code wurde von dort nicht übernommen.
