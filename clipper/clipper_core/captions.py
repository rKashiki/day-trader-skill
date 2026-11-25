"""Animated word-by-word captions as an ASS subtitle file (burned in by ffmpeg/libass)."""

STRIP_CHARS = ",.;:\"'„“”‚‘’«»…()[]"


def ass_color(hex_color, alpha=0):
    """'#RRGGBB' -> '&HAABBGGRR' (ASS stores colours as alpha, blue, green, red)."""
    h = hex_color.lstrip("#")
    r, g, b = h[0:2], h[2:4], h[4:6]
    return "&H%02X%s%s%s" % (alpha, b.upper(), g.upper(), r.upper())


def ass_time(t):
    cs = int(round(max(0.0, t) * 100))
    h, rest = divmod(cs, 360000)
    m, rest = divmod(rest, 6000)
    s, cs = divmod(rest, 100)
    return "%d:%02d:%02d.%02d" % (h, m, s, cs)


def clean_word(word, uppercase=True, remove_punctuation=True):
    w = word.replace("{", "(").replace("}", ")").replace("\\", "")
    if remove_punctuation:
        w = w.strip(STRIP_CHARS)
    if uppercase:
        w = w.upper()
    return w.strip()


def clip_words(words, clip_start, clip_end):
    """Words spoken inside the clip, with times relative to the clip start."""
    out = []
    dur = clip_end - clip_start
    for w in words:
        if w["s"] < clip_start - 0.05 or w["s"] >= clip_end - 0.05:
            continue
        s = min(max(0.0, w["s"] - clip_start), dur)
        e = min(max(s + 0.05, w["e"] - clip_start), dur)
        out.append({"w": w["w"], "s": s, "e": e})
    return out


def chunk_words(words, max_words=3, max_chars=18, max_gap=0.6):
    """Split words into short groups that are shown together."""
    chunks, cur = [], []
    for w in words:
        if cur:
            length = sum(len(x["w"]) for x in cur) + len(cur) + len(w["w"])
            gap = w["s"] - cur[-1]["e"]
            if len(cur) >= max_words or length > max_chars or gap > max_gap:
                chunks.append(cur)
                cur = []
        cur.append(w)
        if w.get("end_of_sentence") and cur:
            chunks.append(cur)
            cur = []
    if cur:
        chunks.append(cur)
    return chunks


def build_ass(words, clip_start, clip_end, cfg, width=1080, height=1920):
    """Return the text of an .ass file for one clip."""
    items = []
    for w in clip_words(words, clip_start, clip_end):
        text = clean_word(w["w"], cfg.uppercase, cfg.remove_punctuation)
        if text:
            items.append({"w": text, "s": w["s"], "e": w["e"],
                          "end_of_sentence": w["w"].rstrip("\"'“”").endswith((".", "?", "!"))})
    chunks = chunk_words(items, int(cfg.max_words), int(cfg.max_chars))
    dur = clip_end - clip_start

    primary = ass_color(cfg.color)
    highlight = ass_color(cfg.highlight_color)
    outline = ass_color(cfg.outline_color)
    shadow = ass_color("#000000", alpha=0x80)
    x, y = width // 2, int(round(float(cfg.position) * height))

    lines = [
        "[Script Info]",
        "ScriptType: v4.00+",
        "PlayResX: %d" % width,
        "PlayResY: %d" % height,
        "WrapStyle: 0",
        "ScaledBorderAndShadow: yes",
        "YCbCr Matrix: TV.709",
        "",
        "[V4+ Styles]",
        "Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, "
        "Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, "
        "Shadow, Alignment, MarginL, MarginR, MarginV, Encoding",
        "Style: Default,%s,%d,%s,%s,%s,%s,0,0,0,0,100,100,1,0,1,%s,%s,5,60,60,0,1"
        % (cfg.font, int(cfg.size), primary, primary, outline, shadow, cfg.outline, cfg.shadow),
        "",
        "[Events]",
        "Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text",
    ]
    for n, chunk in enumerate(chunks):
        next_start = chunks[n + 1][0]["s"] if n + 1 < len(chunks) else dur
        chunk_end = min(chunk[-1]["e"] + 0.25, next_start, dur)
        if next_start - chunk_end < 0.25:
            chunk_end = min(next_start, dur)  # no flicker between close groups
        for k, w in enumerate(chunk):
            start = w["s"]
            end = chunk[k + 1]["s"] if k + 1 < len(chunk) else chunk_end
            if end - start < 0.02:
                continue
            parts = []
            for idx, other in enumerate(chunk):
                if idx == k:
                    parts.append("{\\c%s\\fscx108\\fscy108}%s{\\r}" % (highlight, other["w"]))
                else:
                    parts.append(other["w"])
            lead = "{\\an5\\pos(%d,%d)%s}" % (x, y, "\\fad(60,0)" if k == 0 else "")
            lines.append("Dialogue: 0,%s,%s,Default,,0,0,0,,%s%s"
                         % (ass_time(start), ass_time(end), lead, " ".join(parts)))
    return "\n".join(lines) + "\n"
