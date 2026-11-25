"""Plan the 9:16 framing for every frame of a clip.

How it works:
1. Decode the clip small (640 px wide) and look for camera cuts on every frame.
2. About 6 times per second, find faces (YuNet face detector from OpenCV) and remember a small
   picture of each mouth.
3. Per shot (between two cuts) decide:
   - no face (screen recording, b-roll): show the whole frame on a blurred background ("fit")
   - one face: follow it (or keep the crop still when the person barely moves)
   - several faces that fit into the crop together: frame them together
   - several faces too far apart: show whoever is talking (the mouth that moves most),
     switching with a hard cut like a multi-camera edit.
"""

import os
import subprocess

import numpy as np

from .util import ClipperError, popen

ANALYSIS_WIDTH = 640
DETECT_HZ = 6.0
MIN_FACE_WIDTH = 0.045       # faces narrower than this (share of frame width) are background
MIN_PRESENCE = 0.35          # a face must be seen in this share of a shot's samples
TRACK_DISTANCE = 0.12        # max movement between samples to count as the same face
SWITCH_RATIO = 1.25          # new speaker's mouth must move this much more ...
SWITCH_MARGIN = 1.5          # ... plus this absolute amount
SWITCH_HOLD = 0.8            # ... for this many seconds
MIN_SHOT = 1.5               # never cut between speakers faster than this (seconds)


class Plan:
    """Per output frame: show the whole frame (fit) or a crop centred at cx (0..1 of width)."""

    def __init__(self, n_frames, crop_width):
        self.n = max(1, n_frames)
        self.crop_width = crop_width
        self.fit = np.ones(self.n, dtype=bool)
        self.cx = np.full(self.n, 0.5)
        self.shots = 0
        self.switches = 0

    def at(self, i):
        i = min(max(i, 0), self.n - 1)
        return bool(self.fit[i]), float(self.cx[i])

    def summary(self):
        crop_share = 1.0 - float(np.mean(self.fit))
        parts = ["%d Einstellung%s" % (self.shots, "" if self.shots == 1 else "en")]
        if crop_share > 0.99:
            parts.append("Zuschnitt auf Gesicht")
        elif crop_share < 0.01:
            parts.append("ganzes Bild mit Hintergrund")
        else:
            parts.append("%d %% Zuschnitt, Rest ganzes Bild" % round(crop_share * 100))
        if self.switches:
            parts.append("%d Sprecherwechsel" % self.switches)
        return ", ".join(parts)


def fit_only(n_frames=1):
    plan = Plan(n_frames, 1.0)
    plan.shots = 1
    return plan


class FaceDetector:
    def __init__(self, model_path):
        import cv2
        self.cv2 = cv2
        self.yunet = None
        self.size = None
        if os.path.exists(model_path) and hasattr(cv2, "FaceDetectorYN"):
            try:
                self.yunet = cv2.FaceDetectorYN.create(model_path, "", (320, 320), 0.6, 0.3, 50)
            except cv2.error:
                self.yunet = None
        if self.yunet is None:  # fallback: older but always available detector, no mouth tracking
            self.haar = cv2.CascadeClassifier(cv2.data.haarcascades + "haarcascade_frontalface_default.xml")

    def detect(self, frame):
        """Faces as dicts with normalized centre/size and a mouth patch (or None)."""
        cv2 = self.cv2
        h, w = frame.shape[:2]
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        faces = []
        if self.yunet is not None:
            if self.size != (w, h):
                self.yunet.setInputSize((w, h))
                self.size = (w, h)
            _, found = self.yunet.detect(frame)
            for f in (found if found is not None else []):
                x, y, fw, fh = [float(v) for v in f[:4]]
                landmarks = np.asarray(f[4:14], dtype=np.float32).reshape(5, 2)
                faces.append({
                    "cx": (x + fw / 2) / w, "cy": (y + fh / 2) / h, "w": fw / w, "h": fh / h,
                    "mouth": _mouth_patch(gray, landmarks, fw),
                })
        else:
            for (x, y, fw, fh) in self.haar.detectMultiScale(gray, 1.1, 5, minSize=(24, 24)):
                faces.append({"cx": (x + fw / 2) / w, "cy": (y + fh / 2) / h, "w": fw / w,
                              "h": fh / h, "mouth": None})
        return faces


def _mouth_patch(gray, landmarks, face_width):
    """A small, brightness-normalized picture of the mouth; it changes when someone talks."""
    import cv2
    right, left = landmarks[3], landmarks[4]
    mx, my = (right + left) / 2.0
    mw = max(abs(float(left[0] - right[0])), 0.25 * face_width, 4.0)
    x0, x1 = int(mx - 0.9 * mw), int(mx + 0.9 * mw)
    y0, y1 = int(my - 0.55 * mw), int(my + 0.75 * mw)
    h, w = gray.shape
    x0, y0, x1, y1 = max(0, x0), max(0, y0), min(w, x1), min(h, y1)
    if x1 - x0 < 4 or y1 - y0 < 4:
        return None
    patch = cv2.resize(gray[y0:y1, x0:x1], (24, 16), interpolation=cv2.INTER_AREA).astype(np.float32)
    patch = cv2.GaussianBlur(patch, (3, 3), 0)
    return patch - patch.mean()


def analyze(src, start, duration, fps, src_w, src_h, out_w, out_h, layout, model_path):
    """Decode the clip at low resolution and return a Plan."""
    import cv2

    crop_width = (src_h * out_w / out_h) / src_w
    fps_f = float(fps)
    n_expected = int(duration * fps_f) + 1
    if layout == "fit" or crop_width >= 0.92:
        return fit_only(n_expected)

    aw = ANALYSIS_WIDTH
    ah = max(2, int(round(aw * src_h / src_w / 2)) * 2)
    cmd = ["ffmpeg", "-v", "error", "-ss", "%.3f" % start, "-t", "%.3f" % duration, "-i", src,
           "-an", "-sn", "-vf", "fps=%s,scale=%d:%d" % (fps, aw, ah),
           "-f", "rawvideo", "-pix_fmt", "bgr24", "-"]
    proc = popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL)
    detector = FaceDetector(model_path)
    frame_bytes = aw * ah * 3
    every = max(1, int(round(fps_f / DETECT_HZ)))
    min_scene = max(2, int(fps_f * 0.4))

    cuts, samples = [0], []
    prev_hist = prev_gray = None
    idx = 0
    try:
        while True:
            buf = proc.stdout.read(frame_bytes)
            if len(buf) < frame_bytes:
                break
            frame = np.frombuffer(buf, np.uint8).reshape(ah, aw, 3)
            small = cv2.resize(frame, (64, 36), interpolation=cv2.INTER_AREA)
            hsv = cv2.cvtColor(small, cv2.COLOR_BGR2HSV)
            hist = cv2.calcHist([hsv], [0, 1], None, [16, 8], [0, 180, 0, 256])
            cv2.normalize(hist, hist)
            gray = cv2.cvtColor(small, cv2.COLOR_BGR2GRAY).astype(np.int16)
            new_scene = False
            if prev_hist is not None:
                corr = cv2.compareHist(prev_hist, hist, cv2.HISTCMP_CORREL)
                mad = float(np.mean(np.abs(gray - prev_gray)))
                if (corr < 0.6 or (corr < 0.85 and mad > 25)) and idx - cuts[-1] >= min_scene:
                    cuts.append(idx)
                    new_scene = True
            prev_hist, prev_gray = hist, gray
            if idx % every == 0 or new_scene:
                samples.append((idx, detector.detect(frame)))
            idx += 1
    finally:
        proc.stdout.close()
        proc.wait()
    if idx == 0:
        raise ClipperError("Konnte das Video an dieser Stelle nicht lesen.")

    plan = Plan(idx, crop_width)
    bounds = cuts + [idx]
    for a, b in zip(bounds[:-1], bounds[1:]):
        _plan_shot(plan, a, b, [s for s in samples if a <= s[0] < b], layout, fps_f)
    plan.shots = len(cuts)
    return plan


def _plan_shot(plan, a, b, samples, layout, fps):
    tracks = _tracks(samples, fps)
    n_samples = max(1, len(samples))
    min_presence = MIN_PRESENCE if n_samples >= 3 else 0.5
    main = [t for t in tracks
            if len(t["dets"]) / n_samples >= min_presence and _median(t, "w") >= MIN_FACE_WIDTH]
    if main and _looks_like_facecam(main):
        main = []
    if not main:
        plan.fit[a:b] = layout != "crop"
        plan.cx[a:b] = 0.5
        return

    plan.fit[a:b] = False
    if len(main) == 1:
        segments = [(a, b, main[0])]
    else:
        left = min(_median(t, "cx") - _median(t, "w") / 2 for t in main)
        right = max(_median(t, "cx") + _median(t, "w") / 2 for t in main)
        if (right - left) * 1.3 <= plan.crop_width:
            plan.cx[a:b] = _clamp((left + right) / 2, plan.crop_width)
            return
        segments = _speaker_segments(main, samples, a, b, fps)
        plan.switches += len(segments) - 1
    for sa, sb, track in segments:
        plan.cx[sa:sb] = _follow(track, sa, sb, plan.crop_width, fps)


def _tracks(samples, fps=30.0):
    """Link faces across samples by position (a face may move further the longer it was unseen)."""
    tracks = []
    for idx, faces in samples:
        taken = set()
        for f in sorted(faces, key=lambda f: -f["w"]):
            best, best_d = None, None
            for n, t in enumerate(tracks):
                if n in taken:
                    continue
                gap = (idx - t["last_idx"]) / fps
                limit = max(TRACK_DISTANCE, 0.8 * f["w"]) + min(0.2, 0.1 * gap)
                d = abs(t["last"]["cx"] - f["cx"]) + 0.5 * abs(t["last"]["cy"] - f["cy"])
                if d < limit and (best_d is None or d < best_d):
                    best, best_d = n, d
            if best is None:
                tracks.append({"dets": [], "last": f, "last_idx": idx})
                best = len(tracks) - 1
            tracks[best]["dets"].append((idx, f))
            tracks[best]["last"] = f
            tracks[best]["last_idx"] = idx
            taken.add(best)
    return tracks


def _median(track, key):
    return float(np.median([f[key] for _, f in track["dets"]]))


def _looks_like_facecam(main):
    """A small face in a corner over a screen recording or game: better show the whole frame."""
    return all(_median(t, "w") < 0.09 and (_median(t, "cx") < 0.22 or _median(t, "cx") > 0.78)
               for t in main)


def _mouth_change(a, b, shift=2):
    """How much a mouth changed between two samples. Small shifts of the face detector
    (a pixel or two) are ignored by comparing against the best-matching shifted patch."""
    h, w = a.shape
    core = a[shift:h - shift, shift:w - shift]
    best = None
    for dy in range(-shift, shift + 1):
        for dx in range(-shift, shift + 1):
            other = b[shift + dy:h - shift + dy, shift + dx:w - shift + dx]
            d = float(np.mean(np.abs(core - other)))
            if best is None or d < best:
                best = d
    return best


def _speaker_segments(main, samples, a, b, fps):
    """Split a shot into parts, each showing the person whose mouth moves most."""
    times = [idx for idx, _ in samples]
    biggest = max(main, key=lambda t: _median(t, "w"))
    if len(times) < 2:
        return [(a, b, biggest)]
    act = np.zeros((len(times), len(main)))
    present = np.zeros((len(times), len(main)))
    seen = False
    for c, t in enumerate(main):
        by_idx = dict(t["dets"])
        prev = None
        for r, idx in enumerate(times):
            f = by_idx.get(idx)
            present[r, c] = f is not None
            mouth = f["mouth"] if f is not None else None
            if mouth is not None and prev is not None:
                act[r, c] = _mouth_change(mouth, prev)
                seen = True
            prev = mouth
    if not seen:
        return [(a, b, biggest)]

    win = max(1, int(round(DETECT_HZ)))
    kernel = np.ones(win) / win
    smooth = np.column_stack([np.convolve(act[:, c], kernel, mode="same") for c in range(len(main))])
    visible = np.column_stack([np.convolve(present[:, c], kernel, mode="same") for c in range(len(main))])
    first = smooth[: max(2, int(win * 1.5))].mean(axis=0)
    current = int(np.argmax(first))
    starts = [(a, current)]
    challenger, since = None, None
    for r, idx in enumerate(times):
        gone = visible[r, current] < 0.2          # the person shown left the frame
        candidates = np.where(visible[r] >= 0.5, smooth[r], -1.0)
        best = int(np.argmax(candidates))
        louder = candidates[best] > SWITCH_RATIO * smooth[r, current] + SWITCH_MARGIN
        if best != current and candidates[best] >= 0 and (gone or louder):
            if challenger != best:
                challenger, since = best, idx
            elif idx - since >= SWITCH_HOLD * fps and b - since >= MIN_SHOT * fps \
                    and (gone or since - starts[-1][0] >= MIN_SHOT * fps):
                starts.append((since, best))
                current, challenger = best, None
        else:
            challenger = None
    segments = []
    for n, (s, c) in enumerate(starts):
        e = starts[n + 1][0] if n + 1 < len(starts) else b
        segments.append((s, e, main[c]))
    return segments


def _follow(track, sa, sb, crop_width, fps):
    """Crop centre for frames sa..sb: still if the person barely moves, else a smooth follow."""
    dets = [(idx, f["cx"]) for idx, f in track["dets"]]
    inside = [d for d in dets if sa <= d[0] < sb] or \
        [min(dets, key=lambda d: min(abs(d[0] - sa), abs(d[0] - sb)))]
    xs = np.array([d[0] for d in inside], dtype=float)
    cx = np.array([d[1] for d in inside], dtype=float)
    frames = np.arange(sa, sb, dtype=float)
    med = float(np.median(cx))
    if np.percentile(np.abs(cx - med), 90) < 0.18 * crop_width:
        series = np.full(len(frames), med)
    else:
        series = _smooth(np.interp(frames, xs, cx), 0.5 * fps)
    return np.clip(series, crop_width / 2, 1 - crop_width / 2)


def _smooth(x, sigma):
    if sigma < 1 or len(x) < 3:
        return x
    r = int(3 * sigma)
    k = np.exp(-0.5 * (np.arange(-r, r + 1) / sigma) ** 2)
    k /= k.sum()
    return np.convolve(np.pad(x, r, mode="edge"), k, mode="valid")


def _clamp(cx, crop_width):
    return min(max(cx, crop_width / 2), 1 - crop_width / 2)
