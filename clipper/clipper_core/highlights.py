"""Step 3: Claude reads the transcript and picks the best moments for short clips."""

import json
import os

from .transcribe import sentences
from .util import ClipperError, fmt_time, log

# USD per million tokens (input, output), for the cost estimate printed after the call.
PRICES = {
    "claude-opus-5-5": (4.0, 20.0),
    "claude-opus-5": (5.0, 25.0),
    "claude-sonnet-5-5": (2.0, 10.0),
    "claude-sonnet-5": (2.0, 10.0),
    "claude-haiku-5-5": (0.10, 0.50),
    "claude-fable-5-2": (8.0, 40.0),
}
# Models that support the server-side refusal fallback (`fallbacks: "default"`).
FALLBACK_MODELS = ("claude-opus-5-5", "claude-opus-5", "claude-sonnet-5-5", "claude-fable-5-2",
                   "claude-fable-5-1")
FALLBACK_BETA = "server-side-fallback-2026-07-01"

SYSTEM = (
    "You are a senior short-form video editor. You find the moments in long videos that work as "
    "standalone vertical clips on TikTok, YouTube Shorts and Instagram Reels, and you are honest "
    "about which moments are strong and which are filler."
)

SCHEMA = {
    "type": "object",
    "properties": {
        "clips": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "start": {"type": "number"},
                    "end": {"type": "number"},
                    "title": {"type": "string"},
                    "hook": {"type": "string"},
                    "description": {"type": "string"},
                    "hashtags": {"type": "array", "items": {"type": "string"}},
                    "score": {"type": "integer"},
                    "reason": {"type": "string"},
                },
                "required": ["start", "end", "title", "hook", "description", "hashtags",
                             "score", "reason"],
                "additionalProperties": False,
            },
        }
    },
    "required": ["clips"],
    "additionalProperties": False,
}


def build_prompt(title, duration, language, lines, count, min_s, max_s, focus, output_language):
    transcript = "\n".join("[%.2f-%.2f] %s" % (l["s"], l["e"], l["text"]) for l in lines)
    lang = output_language or ("the language of the video (%s)" % language)
    focus_line = ""
    if focus:
        focus_line = "- The creator asked for this focus, prefer moments that match it: %s\n" % focus
    return (
        "<video>\nTitle: %s\nDuration: %s\nSpoken language: %s\n</video>\n\n"
        "<transcript>\n%s\n</transcript>\n\n"
        "Pick the %d best clips from this video.\n\n"
        "A good clip:\n"
        "- Hooks the viewer with its very first sentence: a bold claim, a surprising fact, a question, "
        "a strong emotion or a conflict. No warm-up like \"so, as I said\".\n"
        "- Makes sense without the rest of the video and ends on a payoff (punchline, answer, insight), "
        "not in the middle of a thought.\n"
        "- Is between %d and %d seconds long.\n"
        "- Starts exactly at the start time of a transcript line and ends exactly at the end time of a "
        "line. Copy the numbers from the transcript.\n"
        "- Does not overlap with another clip.\n"
        "%s\n"
        "For each clip return: start and end in seconds; a catchy title of at most 60 characters; the "
        "hook (the opening line as spoken); a description of one or two sentences for the post; 3 to 6 "
        "hashtags without the # sign; a score from 0 to 100 for how well it will perform as a short "
        "(be critical and use the whole range); and one sentence on why the moment works.\n\n"
        "Write title, description and hashtags in %s. Order the clips from best to worst. If the video "
        "has fewer strong moments than requested, return fewer clips instead of weak ones."
        % (title, fmt_time(duration), language, transcript, count, min_s, max_s, focus_line, lang)
    )


NO_KEY = ("Kein API-Key gefunden. Öffne die Datei .env im Clipper-Ordner und trage deinen Key ein:\n"
          "  ANTHROPIC_API_KEY=sk-ant-...\n"
          "Einen Key bekommst du unter https://console.anthropic.com (Settings > API Keys).")


def check_credentials():
    """Fail early (before download and transcription) when no API key is configured."""
    if os.environ.get("ANTHROPIC_API_KEY") or os.environ.get("ANTHROPIC_AUTH_TOKEN") \
            or os.environ.get("ANTHROPIC_PROFILE"):
        return
    home = os.path.expanduser("~")
    for folder in (os.path.join(home, ".config", "anthropic"),
                   os.path.join(os.environ.get("APPDATA", home), "anthropic")):
        if os.path.isdir(folder):
            return  # logged in with `ant auth login`
    raise ClipperError(NO_KEY)


def pick(video, transcript, cfg_clips, cfg_ai):
    """Ask Claude for clip candidates and return cleaned-up clips."""
    try:
        import anthropic
    except ImportError:
        raise ClipperError("Das Paket 'anthropic' fehlt. Bitte setup_windows.bat erneut ausführen.")

    words = transcript["words"]
    duration = transcript.get("duration") or words[-1]["e"]
    lines = sentences(words)
    prompt = build_prompt(video["title"], duration, transcript["language"], lines,
                          int(cfg_clips.count), int(cfg_clips.min_seconds), int(cfg_clips.max_seconds),
                          cfg_clips.focus, cfg_ai.output_language)
    model = cfg_ai.model
    log("  Frage %s nach den besten %d Momenten (%d Transkript-Zeilen) ..."
        % (model, int(cfg_clips.count), len(lines)))

    try:
        client = anthropic.Anthropic(max_retries=3)
        params = dict(
            model=model,
            max_tokens=32000,
            system=SYSTEM,
            output_config={"effort": cfg_ai.effort,
                           "format": {"type": "json_schema", "schema": SCHEMA}},
            messages=[{"role": "user", "content": prompt}],
        )
        if model in FALLBACK_MODELS:
            # If a safety classifier declines, the API re-runs the request on a fallback model.
            stream = client.beta.messages.stream(betas=[FALLBACK_BETA], fallbacks="default", **params)
        else:
            stream = client.messages.stream(**params)
        with stream as s:
            response = s.get_final_message()
    except anthropic.AuthenticationError:
        raise ClipperError("Der API-Key wurde abgelehnt. Trage einen gültigen Key in die Datei .env ein "
                           "(ANTHROPIC_API_KEY=...).")
    except anthropic.CredentialsError:
        raise ClipperError(NO_KEY)
    except TypeError as exc:
        if "authentication" in str(exc).lower():
            raise ClipperError(NO_KEY)
        raise
    except anthropic.PermissionDeniedError as exc:
        raise ClipperError("Der API-Key hat keinen Zugriff auf dieses Modell: %s" % exc.message)
    except anthropic.NotFoundError:
        raise ClipperError("Modell '%s' nicht gefunden. Prüfe ai.model in settings.toml." % model)
    except anthropic.RateLimitError:
        raise ClipperError("Zu viele Anfragen oder kein Guthaben mehr. Warte kurz oder prüfe dein "
                           "Guthaben unter console.anthropic.com.")
    except anthropic.BadRequestError as exc:
        raise ClipperError("Die KI-Anfrage wurde abgelehnt: %s" % exc.message)
    except anthropic.APIStatusError as exc:
        raise ClipperError("Fehler bei der KI (%s): %s" % (exc.status_code, exc.message))
    except anthropic.APIConnectionError:
        raise ClipperError("Keine Verbindung zur KI. Prüfe deine Internetverbindung.")

    if response.stop_reason == "refusal":
        details = getattr(response, "stop_details", None)
        why = getattr(details, "explanation", None) or "ohne Begründung"
        raise ClipperError("Die KI hat die Auswahl abgelehnt (%s)." % why)
    if response.stop_reason == "max_tokens":
        raise ClipperError("Die Antwort der KI war zu lang. Versuche es mit weniger Clips.")
    text = next((b.text for b in response.content if b.type == "text"), None)
    try:
        raw = json.loads(text or "")["clips"]
    except (ValueError, KeyError, TypeError):
        raise ClipperError("Die Antwort der KI war unvollständig. Bitte erneut versuchen.")

    _log_usage(model, response.usage)
    clips = finalize(raw, words, duration, float(cfg_clips.min_seconds),
                     float(cfg_clips.max_seconds), int(cfg_clips.count))
    if not clips:
        raise ClipperError("Die KI hat keine passenden Clips gefunden. Versuche andere Längen in settings.toml.")
    return clips


def _log_usage(model, usage):
    tokens_in = (usage.input_tokens or 0) + (getattr(usage, "cache_read_input_tokens", 0) or 0) + \
        (getattr(usage, "cache_creation_input_tokens", 0) or 0)
    tokens_out = usage.output_tokens or 0
    price = PRICES.get(model)
    cost = ""
    if price:
        cost = ", ca. %.2f $" % (tokens_in / 1e6 * price[0] + tokens_out / 1e6 * price[1])
    log("  KI-Verbrauch: %d Tokens rein, %d Tokens raus%s" % (tokens_in, tokens_out, cost))


def finalize(raw, words, duration, min_s, max_s, count):
    """Snap the AI's times to word boundaries, enforce the length, drop overlaps."""
    clips = []
    for c in raw:
        try:
            start, end = float(c["start"]), float(c["end"])
        except (KeyError, TypeError, ValueError):
            continue
        start, end = max(0.0, start), min(duration, end)
        if end <= start:
            continue
        i, j = _snap(start, end, words)
        if i is None:
            continue
        # Too long: end at the last word that still fits.
        while j > i and words[j]["e"] - words[i]["s"] > max_s + 1.0:
            j -= 1
        if words[j]["e"] - words[i]["s"] < min_s * 0.6:
            continue
        s, e = _pad(i, j, words, duration)
        if any(_overlap(s, e, o["start"], o["end"]) > 0.3 for o in clips):
            continue
        clips.append({
            "start": round(s, 3),
            "end": round(e, 3),
            "title": str(c.get("title", "")).strip() or "Clip",
            "hook": str(c.get("hook", "")).strip(),
            "description": str(c.get("description", "")).strip(),
            "hashtags": [str(h).strip().lstrip("#").replace(" ", "") for h in c.get("hashtags", []) if str(h).strip()],
            "score": int(c.get("score", 0) or 0),
            "reason": str(c.get("reason", "")).strip(),
        })
        if len(clips) >= count:
            break
    clips.sort(key=lambda x: -x["score"])
    return clips


def _snap(start, end, words, window=2.5):
    """Indexes of the first and last word of the clip, close to the requested times."""
    near_start = [k for k, w in enumerate(words) if abs(w["s"] - start) <= window]
    if near_start:
        i = min(near_start, key=lambda k: abs(words[k]["s"] - start))
    else:
        i = next((k for k, w in enumerate(words) if w["s"] >= start), None)
        if i is None:
            return None, None
    near_end = [k for k, w in enumerate(words) if k >= i and abs(w["e"] - end) <= window]
    if near_end:
        j = min(near_end, key=lambda k: abs(words[k]["e"] - end))
    else:
        inside = [k for k, w in enumerate(words) if k >= i and w["e"] <= end]
        j = inside[-1] if inside else i
    return i, j


def _pad(i, j, words, duration):
    """A little air before the first and after the last word, without catching the neighbours."""
    s = words[i]["s"] - 0.15
    if i > 0:
        s = max(s, min(words[i - 1]["e"] + 0.02, words[i]["s"] - 0.02))
    e = words[j]["e"] + 0.35
    if j + 1 < len(words):
        e = min(e, max(words[j + 1]["s"] - 0.02, words[j]["e"]))
    return max(0.0, s), min(duration, e)


def _overlap(s1, e1, s2, e2):
    inter = max(0.0, min(e1, e2) - max(s1, s2))
    shorter = min(e1 - s1, e2 - s2)
    return inter / shorter if shorter > 0 else 0.0
