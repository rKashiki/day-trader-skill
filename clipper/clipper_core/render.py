"""Step 4: cut, reframe to 9:16, burn in captions and encode one clip.

ffmpeg decodes the source into raw frames, Python builds each vertical frame (crop or blurred
background), and a second ffmpeg burns in the captions and encodes the result with the audio.
"""

import os
import shutil
import subprocess
import sys

import numpy as np

from .util import ClipperError, log, popen

_encoder_cache = {}


def pick_encoder(preference):
    """'nvenc' if the Nvidia encoder really works on this machine, else 'x264'."""
    if preference in _encoder_cache:
        return _encoder_cache[preference]
    choice = "x264"
    if preference in ("auto", "nvenc"):
        test = subprocess.run(
            ["ffmpeg", "-v", "error", "-f", "lavfi", "-i", "color=black:s=640x360:d=0.2",
             "-c:v", "h264_nvenc", "-f", "null", "-"],
            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
            creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0))
        if test.returncode == 0:
            choice = "nvenc"
        elif preference == "nvenc":
            log("  Hinweis: Nvidia-Encoder (NVENC) nicht verfügbar, nutze den Prozessor (x264).")
    _encoder_cache[preference] = choice
    return choice


def encoder_args(encoder, quality):
    q = str(int(quality))
    if encoder == "nvenc":
        return ["-c:v", "h264_nvenc", "-preset", "p5", "-rc", "vbr", "-cq", q, "-b:v", "0",
                "-profile:v", "high"]
    return ["-c:v", "libx264", "-preset", "medium", "-crf", q, "-profile:v", "high"]


def decode_size(src_w, src_h, max_h=1080):
    """Decode at most 1080p (enough for a 1080x1920 crop), keep even sizes."""
    if src_h <= max_h:
        return src_w - src_w % 2, src_h - src_h % 2
    w = int(round(src_w * max_h / src_h / 2)) * 2
    return w, max_h


class Composer:
    """Builds one vertical output frame from one source frame."""

    def __init__(self, src_w, src_h, out_w, out_h):
        import cv2
        self.cv2 = cv2
        self.sw, self.sh, self.ow, self.oh = src_w, src_h, out_w, out_h
        self.crop_w = min(src_w, int(round(src_h * out_w / out_h)))
        scale = min(out_w / src_w, out_h / src_h)
        self.fg_w = max(2, int(round(src_w * scale / 2)) * 2)
        self.fg_h = max(2, int(round(src_h * scale / 2)) * 2)
        self.fg_x = (out_w - self.fg_w) // 2
        # Whole-frame layout sits a bit above the middle, so the captions fit below it.
        self.fg_y = min(max(0, int(out_h * 0.42 - self.fg_h / 2)), out_h - self.fg_h)
        # Background: the middle part of the frame in the output's shape, blurred and darkened.
        if src_w / src_h > out_w / out_h:
            bw = int(src_h * out_w / out_h)
            self.bg_box = ((src_w - bw) // 2, 0, bw, src_h)
        else:
            bh = int(src_w * out_h / out_w)
            self.bg_box = (0, (src_h - bh) // 2, src_w, bh)

    def crop(self, frame, cx):
        cv2 = self.cv2
        x0 = int(round(cx * self.sw - self.crop_w / 2))
        x0 = min(max(0, x0), self.sw - self.crop_w)
        part = frame[:, x0:x0 + self.crop_w]
        interp = cv2.INTER_CUBIC if self.oh > self.sh else cv2.INTER_AREA
        return cv2.resize(part, (self.ow, self.oh), interpolation=interp)

    def fit(self, frame):
        cv2 = self.cv2
        x, y, w, h = self.bg_box
        small = cv2.resize(frame[y:y + h, x:x + w], (max(8, self.ow // 12), max(8, self.oh // 12)),
                           interpolation=cv2.INTER_AREA)
        small = cv2.GaussianBlur(small, (0, 0), 2.5)
        out = cv2.resize(small, (self.ow, self.oh), interpolation=cv2.INTER_LINEAR)
        out = cv2.convertScaleAbs(out, alpha=0.55)
        interp = cv2.INTER_CUBIC if self.fg_w > self.sw else cv2.INTER_AREA
        fg = cv2.resize(frame, (self.fg_w, self.fg_h), interpolation=interp)
        out[self.fg_y:self.fg_y + self.fg_h, self.fg_x:self.fg_x + self.fg_w] = fg
        return out

    def compose(self, frame, fit, cx):
        if fit or self.crop_w >= self.sw:
            return self.fit(frame)
        return self.crop(frame, cx)


def render(src, info, start, end, plan, ass_text, out_path, video_cfg, fonts_dir, tmp_dir, label):
    """Write the finished clip to out_path."""
    os.makedirs(tmp_dir, exist_ok=True)
    W, H = int(video_cfg.width), int(video_cfg.height)
    fps = info["fps"]
    duration = end - start
    dw, dh = decode_size(info["width"], info["height"])
    composer = Composer(dw, dh, W, H)

    vf = []
    if ass_text:
        with open(os.path.join(tmp_dir, "captions.ass"), "w", encoding="utf-8") as fh:
            fh.write(ass_text)
        shutil.copytree(fonts_dir, os.path.join(tmp_dir, "fonts"), dirs_exist_ok=True)
        # Relative names: ffmpeg runs inside tmp_dir, so Windows paths (C:\...) never reach the filter.
        vf.append("ass=captions.ass:fontsdir=fonts")
    vf.append("scale=out_color_matrix=bt709:out_range=tv,format=yuv420p")

    encoder = pick_encoder(video_cfg.encoder)
    dec_log = open(os.path.join(tmp_dir, "decode.log"), "wb")
    enc_log = open(os.path.join(tmp_dir, "encode.log"), "wb")
    dec = popen(["ffmpeg", "-v", "error", "-ss", "%.3f" % start, "-t", "%.3f" % duration, "-i", src,
                 "-an", "-sn", "-vf", "fps=%s,scale=%d:%d" % (fps, dw, dh),
                 "-f", "rawvideo", "-pix_fmt", "bgr24", "-"],
                stdout=subprocess.PIPE, stderr=dec_log)
    enc_cmd = ["ffmpeg", "-y", "-v", "error",
               "-f", "rawvideo", "-pix_fmt", "bgr24", "-s", "%dx%d" % (W, H), "-r", str(fps), "-i", "-",
               "-ss", "%.3f" % start, "-t", "%.3f" % duration, "-i", src,
               "-map", "0:v:0", "-map", "1:a:0?",
               "-vf", ",".join(vf)] + encoder_args(encoder, video_cfg.quality) + [
               "-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "bt709",
               "-color_range", "tv",
               "-c:a", "aac", "-b:a", "192k", "-ar", "48000",
               "-shortest", "-movflags", "+faststart", os.path.abspath(out_path)]
    enc = popen(enc_cmd, cwd=tmp_dir, stdin=subprocess.PIPE, stderr=enc_log)

    frame_bytes = dw * dh * 3
    total = max(1, int(duration * float(fps)))
    i, last_pct = 0, -1
    try:
        while True:
            buf = dec.stdout.read(frame_bytes)
            if len(buf) < frame_bytes:
                break
            frame = np.frombuffer(buf, np.uint8).reshape(dh, dw, 3)
            fit, cx = plan.at(i)
            out = composer.compose(frame, fit, cx)
            enc.stdin.write(np.ascontiguousarray(out).data)
            i += 1
            pct = min(100, i * 100 // total)
            if pct >= last_pct + 10:
                last_pct = pct
                sys.stdout.write("\r  %s: %3d %%" % (label, pct))
                sys.stdout.flush()
    except (BrokenPipeError, OSError):
        pass  # the encoder stopped; its log tells why
    finally:
        dec.stdout.close()
        try:
            enc.stdin.close()
        except OSError:
            pass
        dec.wait()
        enc.wait()
        dec_log.close()
        enc_log.close()

    if enc.returncode != 0 or i == 0 or not os.path.exists(out_path):
        problem = _tail(os.path.join(tmp_dir, "encode.log")) or _tail(os.path.join(tmp_dir, "decode.log"))
        raise ClipperError("Rendern fehlgeschlagen (%s).\n%s" % (label, problem or "keine Details"))
    sys.stdout.write("\r  %s: fertig     \n" % label)
    sys.stdout.flush()
    return encoder


def _tail(path, n=12):
    try:
        with open(path, encoding="utf-8", errors="replace") as fh:
            return "\n".join(fh.read().strip().splitlines()[-n:])
    except OSError:
        return ""
