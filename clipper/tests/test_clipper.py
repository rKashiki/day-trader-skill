"""Unit tests for the parts that need no video, GPU or API key.

Run from the clipper folder:  python -m unittest discover tests
"""

import os
import sys
import tempfile
import unittest

import numpy as np

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, HERE)

from clipper_core import captions, highlights, reframe, settings, transcribe  # noqa: E402
from clipper_core.util import ClipperError, fmt_time, safe_filename  # noqa: E402


def words_from(text, start=0.0, step=0.4, gap_after=None):
    """Fake transcript words, 0.4 s apart; gap_after={index: extra seconds}."""
    out, t = [], start
    for n, w in enumerate(text.split()):
        out.append({"w": w, "s": round(t, 3), "e": round(t + 0.3, 3)})
        t += step + (gap_after or {}).get(n, 0.0)
    return out


class Captions(unittest.TestCase):
    def setUp(self):
        self.cfg = settings.load(None).captions

    def test_ass_colour_is_blue_green_red(self):
        self.assertEqual(captions.ass_color("#FFE11A"), "&H001AE1FF")
        self.assertEqual(captions.ass_color("000000", alpha=0x80), "&H80000000")

    def test_ass_time(self):
        self.assertEqual(captions.ass_time(0), "0:00:00.00")
        self.assertEqual(captions.ass_time(3723.456), "1:02:03.46")

    def test_clean_word(self):
        self.assertEqual(captions.clean_word("hallo,"), "HALLO")
        self.assertEqual(captions.clean_word("wirklich?"), "WIRKLICH?")
        self.assertEqual(captions.clean_word("{x}\\", remove_punctuation=False), "(X)")
        self.assertEqual(captions.clean_word("{x}\\"), "X")
        self.assertEqual(captions.clean_word("straße", uppercase=False), "straße")

    def test_chunks_respect_word_and_char_limits_and_pauses(self):
        ws = words_from("eins zwei drei vier fünf sechs sieben", gap_after={4: 1.0})
        chunks = captions.chunk_words(ws, max_words=3, max_chars=18)
        self.assertEqual([[w["w"] for w in c] for c in chunks],
                         [["eins", "zwei", "drei"], ["vier", "fünf"], ["sechs", "sieben"]])
        long = captions.chunk_words(words_from("Donaudampfschifffahrt ist lang"), 3, 18)
        self.assertEqual(len(long[0]), 1)

    def test_build_ass_highlights_each_word_once(self):
        ws = words_from("Das ist ein Test. Und noch mehr", start=10.0)
        text = captions.build_ass(ws, 10.0, 13.0, self.cfg)
        events = [l for l in text.splitlines() if l.startswith("Dialogue:")]
        self.assertEqual(len(events), 7)
        self.assertTrue(all(e.count("\\fscx108") == 1 for e in events))
        self.assertIn("0:00:00.00", events[0])
        self.assertIn("TEST", text)
        self.assertNotIn("TEST.", text)
        # The sentence ends after "Test.", so "UND" starts a new group.
        self.assertNotIn("TEST UND", text)
        self.assertIn("PlayResY: 1920", text)

    def test_words_outside_the_clip_are_left_out(self):
        ws = words_from("vorher drin drin nachher", start=0.0, step=1.0)
        inside = captions.clip_words(ws, 0.9, 2.8)
        self.assertEqual([w["w"] for w in inside], ["drin", "drin"])
        self.assertAlmostEqual(inside[0]["s"], 0.1, places=3)


class Highlights(unittest.TestCase):
    def setUp(self):
        # 100 words, one every 0.4 s: 0.0 .. 39.6 s
        self.words = words_from(" ".join("w%d" % i for i in range(100)))

    def test_snaps_to_words_and_pads(self):
        clips = highlights.finalize([{"start": 4.05, "end": 20.2, "title": "A", "score": 50}],
                                    self.words, 40.0, 10, 30, 5)
        self.assertEqual(len(clips), 1)
        c = clips[0]
        # word 10 starts at 4.0; previous word ends at 3.9 -> start between 3.9 and 4.0
        self.assertTrue(3.9 <= c["start"] <= 4.0, c["start"])
        # word 50 ends at 20.3; next starts at 20.4 -> end before 20.4
        self.assertTrue(20.3 <= c["end"] < 20.4, c["end"])

    def test_too_long_is_shortened_and_too_short_dropped(self):
        clips = highlights.finalize([
            {"start": 0.0, "end": 39.0, "title": "long", "score": 90},
            {"start": 30.0, "end": 31.0, "title": "short", "score": 80},
        ], self.words, 40.0, 10, 20, 5)
        self.assertEqual([c["title"] for c in clips], ["long"])
        self.assertLessEqual(clips[0]["end"] - clips[0]["start"], 21.5)

    def test_overlapping_clips_are_dropped_and_sorted_by_score(self):
        clips = highlights.finalize([
            {"start": 0.0, "end": 15.0, "title": "a", "score": 60},
            {"start": 2.0, "end": 16.0, "title": "overlap", "score": 99},
            {"start": 20.0, "end": 35.0, "title": "b", "score": 70},
        ], self.words, 40.0, 10, 30, 5)
        self.assertEqual([c["title"] for c in clips], ["b", "a"])

    def test_hashtags_are_cleaned(self):
        clips = highlights.finalize([{"start": 0, "end": 12, "title": "t", "score": 1,
                                      "hashtags": ["#Klima", " wetter ", "", "zwei worte"]}],
                                    self.words, 40.0, 10, 30, 5)
        self.assertEqual(clips[0]["hashtags"], ["Klima", "wetter", "zweiworte"])

    def test_prompt_carries_transcript_limits_and_focus(self):
        lines = [{"s": 1.0, "e": 2.5, "text": "Hallo Welt."}]
        p = highlights.build_prompt("Titel", 90, "de", lines, 4, 20, 45, "lustige Momente", "")
        self.assertIn("[1.00-2.50] Hallo Welt.", p)
        self.assertIn("4 best clips", p)
        self.assertIn("between 20 and 45 seconds", p)
        self.assertIn("lustige Momente", p)
        self.assertIn("language of the video (de)", p)

    def test_schema_is_strict(self):
        item = highlights.SCHEMA["properties"]["clips"]["items"]
        self.assertFalse(item["additionalProperties"])
        self.assertEqual(sorted(item["required"]), sorted(item["properties"]))


class Sentences(unittest.TestCase):
    def test_split_on_punctuation_and_pauses(self):
        ws = words_from("Erster Satz. Zweiter Teil noch weiter", gap_after={3: 2.0})
        lines = transcribe.sentences(ws)
        self.assertEqual([l["text"] for l in lines], ["Erster Satz.", "Zweiter Teil", "noch weiter"])
        self.assertEqual(lines[0]["s"], ws[0]["s"])
        self.assertEqual(lines[0]["e"], ws[1]["e"])


def face(cx, w=0.15, mouth=None):
    return {"cx": cx, "cy": 0.4, "w": w, "h": w * 1.6, "mouth": mouth}


class Reframe(unittest.TestCase):
    def test_tracks_link_faces_by_position(self):
        samples = [(i, [face(0.25), face(0.75)]) for i in range(0, 50, 5)]
        tracks = reframe._tracks(samples)
        self.assertEqual(len(tracks), 2)
        self.assertTrue(all(len(t["dets"]) == 10 for t in tracks))

    def test_speaker_switch_follows_the_moving_mouth(self):
        fps, rng = 30.0, np.random.default_rng(1)
        samples = []
        for n, idx in enumerate(range(0, 300, 5)):      # 10 s, 6 samples per second
            left_talks = idx < 150                       # left talks first 5 s, then right
            ml = rng.normal(0, 30 if left_talks else 1, (16, 24)).astype(np.float32)
            mr = rng.normal(0, 1 if left_talks else 30, (16, 24)).astype(np.float32)
            samples.append((idx, [face(0.2, mouth=ml), face(0.8, mouth=mr)]))
        tracks = reframe._tracks(samples)
        segs = reframe._speaker_segments(tracks, samples, 0, 300, fps)
        self.assertEqual(len(segs), 2)
        self.assertLess(reframe._median(segs[0][2], "cx"), 0.5)
        self.assertGreater(reframe._median(segs[1][2], "cx"), 0.5)
        self.assertTrue(140 <= segs[1][0] <= 185, segs[1][0])

    def test_quiet_mouths_do_not_cause_switching(self):
        samples = [(idx, [face(0.2, mouth=np.zeros((16, 24), np.float32)),
                          face(0.8, mouth=np.zeros((16, 24), np.float32))])
                   for idx in range(0, 300, 5)]
        segs = reframe._speaker_segments(reframe._tracks(samples), samples, 0, 300, 30.0)
        self.assertEqual(len(segs), 1)

    def test_detector_jitter_is_not_talking(self):
        rng = np.random.default_rng(2)
        mouth = rng.normal(0, 40, (16, 24)).astype(np.float32)
        shifted = np.roll(mouth, 1, axis=1)                 # face detector moved by one pixel
        opened = mouth.copy()
        opened[6:10, 6:18] += 60                            # the mouth really changed
        self.assertLess(reframe._mouth_change(shifted, mouth), 1.0)
        self.assertGreater(reframe._mouth_change(opened, mouth), 5.0)

    def test_switch_when_the_shown_person_leaves(self):
        quiet = np.zeros((16, 24), np.float32)
        samples = []
        for idx in range(0, 300, 5):
            faces = [face(0.8, mouth=quiet)]
            if idx < 120:                                    # left person leaves after 4 s
                faces.append(face(0.2, w=0.2, mouth=quiet))
            samples.append((idx, faces))
        tracks = reframe._tracks(samples)
        segs = reframe._speaker_segments(tracks, samples, 0, 300, 30.0)
        self.assertLess(reframe._median(segs[0][2], "cx"), 0.5)
        self.assertGreater(reframe._median(segs[-1][2], "cx"), 0.5)

    def test_still_person_gets_a_still_crop(self):
        track = {"dets": [(i, face(0.5 + 0.005 * (i % 2))) for i in range(0, 100, 5)]}
        cx = reframe._follow(track, 0, 100, 0.316, 25.0)
        self.assertEqual(len(cx), 100)
        self.assertAlmostEqual(float(cx.max() - cx.min()), 0.0)

    def test_moving_person_is_followed_smoothly_inside_the_frame(self):
        track = {"dets": [(i, face(0.1 + 0.8 * i / 200)) for i in range(0, 200, 5)]}
        cx = reframe._follow(track, 0, 200, 0.316, 25.0)
        self.assertGreater(cx[-1], cx[0] + 0.3)
        self.assertGreaterEqual(cx.min(), 0.158 - 1e-9)
        self.assertLessEqual(cx.max(), 1 - 0.158 + 1e-9)
        self.assertLess(np.max(np.abs(np.diff(cx))), 0.02)

    def test_plan_shot_choices(self):
        def plan_for(faces_per_sample, layout="auto"):
            plan = reframe.Plan(60, 0.316)
            samples = [(i, faces_per_sample) for i in range(0, 60, 5)]
            reframe._plan_shot(plan, 0, 60, samples, layout, 30.0)
            return plan
        self.assertTrue(plan_for([]).fit.all())                       # nobody: whole frame
        self.assertFalse(plan_for([], "crop").fit.any())              # forced crop
        self.assertTrue(plan_for([face(0.9, w=0.05)]).fit.all())      # facecam in a corner
        p = plan_for([face(0.7)])
        self.assertFalse(p.fit.any())
        self.assertAlmostEqual(float(p.cx[0]), 0.7, places=2)
        p = plan_for([face(0.45, w=0.08), face(0.6, w=0.08)])         # two close faces: together
        self.assertAlmostEqual(float(p.cx[0]), 0.525, places=2)

    def test_plan_index_is_clamped(self):
        plan = reframe.Plan(10, 0.3)
        plan.fit[:] = False
        plan.cx[-1] = 0.8
        self.assertEqual(plan.at(500), (False, 0.8))


class UtilAndSettings(unittest.TestCase):
    def test_safe_filename_for_windows(self):
        self.assertEqual(safe_filename('Was?! "Geld" / Zeit: 50%*'), "Was! Geld  Zeit 50%".replace("  ", " "))
        self.assertEqual(safe_filename("CON"), "clip")
        self.assertEqual(safe_filename("ende..."), "ende")
        self.assertEqual(len(safe_filename("x" * 200, maxlen=60)), 60)

    def test_fmt_time(self):
        self.assertEqual(fmt_time(65), "1:05")
        self.assertEqual(fmt_time(3725), "1:02:05")

    def test_shipped_settings_load(self):
        s = settings.load(os.path.join(HERE, "settings.toml"))
        self.assertEqual(s.ai.model, "claude-opus-5-5")
        self.assertEqual(s.clips.layout, "auto")

    def test_bad_settings_are_reported_in_german(self):
        with tempfile.TemporaryDirectory() as d:
            path = os.path.join(d, "s.toml")
            with open(path, "w", encoding="utf-8") as fh:
                fh.write('[clips]\nlayout = "rund"\n')
            with self.assertRaises(ClipperError) as ctx:
                settings.load(path)
            self.assertIn("layout", str(ctx.exception))

    def test_assets_are_shipped(self):
        self.assertTrue(os.path.getsize(os.path.join(HERE, "assets", "models",
                                                     "face_detection_yunet_2023mar.onnx")) > 100000)
        self.assertTrue(os.path.exists(os.path.join(HERE, "assets", "fonts", "Montserrat-Black.ttf")))


if __name__ == "__main__":
    unittest.main()
