/* Video-Studio Kit: läuft im Browser (Canvas 2D, 1080x1920).
 * Eine Szene (scene.js) definiert:
 *    function draw(ctx, t)   – zeichnet den Frame zum Zeitpunkt t (Sekunden). MUSS deterministisch sein.
 *    function cues()         – optional, ruft cue(t, 'sfx', gain) für Sound-Effekte auf.
 * Timing kommt aus window.TIMELINE (build/timeline.json), also immer synchron zur Stimme.
 */
const W = 1080, H = 1920;
const TL = window.TIMELINE || { duration: 10, beats: [] };
const canvas = document.getElementById('c') || (() => {
  const c = document.createElement('canvas'); c.id = 'c'; document.body.appendChild(c); return c;
})();
canvas.width = W; canvas.height = H;
const ctx = canvas.getContext('2d');

/* ---------- Timing ---------- */
const BEATS = Object.fromEntries(TL.beats.map(b => [b.id, b]));
function beat(id) { const b = BEATS[id]; if (!b) throw new Error('Beat fehlt: ' + id); return b; }
const bs = (id, off = 0) => beat(id).start + off;            // Beat-Start
const be = (id, off = 0) => beat(id).end + off;              // Beat-Ende
const norm = s => s.toLowerCase().replace(/[^a-z0-9äöüß]/g, '');
/** Zeitpunkt, an dem im Beat `id` das Wort `needle` gesprochen wird (n-tes Vorkommen). */
function wt(id, needle, n = 0, edge = 'start') {
  const b = beat(id); const k = norm(needle);
  const hits = b.words.filter(w => norm(w.w).startsWith(k));
  const w = hits[n] || hits[0];
  return w ? w[edge] : b.start;
}
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const lerp = (a, b, k) => a + (b - a) * k;
const prog = (t, a, b) => clamp((t - a) / (b - a));
const between = (t, a, b) => t >= a && t < b;
function mixColor(c1, c2, k) {
  const p = c => c.match(/\w\w/g).map(h => parseInt(h, 16));
  const a = p(c1), b = p(c2);
  return '#' + a.map((v, i) => Math.round(lerp(v, b[i], clamp(k))).toString(16).padStart(2, '0')).join('');
}

const E = {
  lin: k => k,
  inCubic: k => k * k * k,
  outCubic: k => 1 - Math.pow(1 - k, 3),
  inOutCubic: k => k < .5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2,
  outBack: k => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(k - 1, 3) + c1 * Math.pow(k - 1, 2); },
  outElastic: k => k === 0 ? 0 : k === 1 ? 1 : Math.pow(2, -10 * k) * Math.sin((k * 10 - .75) * (2 * Math.PI / 3)) + 1,
};
/** Eingeblendeter Fortschritt 0..1 mit Easing. */
const ease = (t, a, dur, fn = E.outCubic) => { const p = prog(t, a, a + dur); return p <= 0 ? 0 : p >= 1 ? 1 : fn(p); };

/* ---------- Determinismus ---------- */
function rand(seed) { let s = seed >>> 0 || 1; return () => ((s = Math.imul(s ^ (s >>> 15), 0x2c1b3c6d) + 0x9e3779b9 >>> 0) / 4294967296); }
const shake = (t, amp, freq = 31, seed = 1) => [Math.sin(t * freq + seed) * amp, Math.cos(t * freq * 1.3 + seed * 2) * amp];

/* ---------- Sound-Cues ---------- */
const CUES = [];
function cue(t, sfx, gain = 0.5) { if (t >= 0 && t < TL.duration) CUES.push({ t: +t.toFixed(3), sfx, gain }); }
window.getCues = () => { CUES.length = 0; if (typeof cues === 'function') cues(); return CUES; };

/* ---------- Zeichnen ---------- */
function rr(x, y, w, h, r) { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); }
function txt(s, x, y, o = {}) {
  ctx.save();
  const size = o.size || 48;
  ctx.font = `${o.weight || 800} ${size}px ${o.font || 'Inter'}`;
  ctx.textAlign = o.align || 'center';
  ctx.textBaseline = o.baseline || 'middle';
  if (o.spacing) ctx.letterSpacing = o.spacing + 'px';
  if (o.alpha !== undefined) ctx.globalAlpha *= o.alpha;
  if (o.stroke) { ctx.lineJoin = 'round'; ctx.lineWidth = o.stroke; ctx.strokeStyle = o.strokeColor || '#000'; ctx.strokeText(s, x, y); }
  if (o.glow) { ctx.shadowColor = o.glow; ctx.shadowBlur = o.glowBlur || 30; }
  ctx.fillStyle = o.color || '#fff';
  ctx.fillText(s, x, y);
  ctx.restore();
}
function line(x1, y1, x2, y2, color = '#fff', w = 4, dash) {
  ctx.save(); ctx.strokeStyle = color; ctx.lineWidth = w; ctx.lineCap = 'round';
  if (dash) ctx.setLineDash(dash);
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); ctx.restore();
}
function arrow(x1, y1, x2, y2, o = {}) {
  const color = o.color || '#fff', w = o.width || 8, head = o.head || w * 3.2;
  const a = Math.atan2(y2 - y1, x2 - x1);
  ctx.save(); ctx.globalAlpha *= (o.alpha ?? 1);
  if (o.glow) { ctx.shadowColor = o.glow; ctx.shadowBlur = 24; }
  ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = w; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2 - Math.cos(a) * head * .6, y2 - Math.sin(a) * head * .6); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x2, y2);
  ctx.lineTo(x2 - Math.cos(a - .45) * head, y2 - Math.sin(a - .45) * head);
  ctx.lineTo(x2 - Math.cos(a + .45) * head, y2 - Math.sin(a + .45) * head);
  ctx.closePath(); ctx.fill(); ctx.restore();
}
/** Polylinie als messbarer Pfad (für fließende Partikel, Zeichnen-Animation). */
function path(pts) {
  const seg = []; let total = 0;
  for (let i = 1; i < pts.length; i++) { const l = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); seg.push(l); total += l; }
  return { pts, seg, total };
}
function pointAt(p, s) {
  s = ((s % p.total) + p.total) % p.total;
  for (let i = 0; i < p.seg.length; i++) {
    if (s <= p.seg[i]) { const k = s / p.seg[i]; return [lerp(p.pts[i][0], p.pts[i + 1][0], k), lerp(p.pts[i][1], p.pts[i + 1][1], k)]; }
    s -= p.seg[i];
  }
  return p.pts[p.pts.length - 1];
}
/** Zeichnet den Pfad bis zum Anteil frac (0..1) – "wird gezeichnet"-Effekt. */
function strokePath(p, frac, color, w, o = {}) {
  if (frac <= 0) return;
  ctx.save(); ctx.strokeStyle = color; ctx.lineWidth = w; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  if (o.glow) { ctx.shadowColor = o.glow; ctx.shadowBlur = o.glowBlur || 20; }
  ctx.globalAlpha *= (o.alpha ?? 1);
  let left = p.total * clamp(frac);
  ctx.beginPath(); ctx.moveTo(...p.pts[0]);
  for (let i = 0; i < p.seg.length && left > 0; i++) {
    if (left >= p.seg[i]) { ctx.lineTo(...p.pts[i + 1]); left -= p.seg[i]; }
    else { const k = left / p.seg[i]; ctx.lineTo(lerp(p.pts[i][0], p.pts[i + 1][0], k), lerp(p.pts[i][1], p.pts[i + 1][1], k)); left = 0; }
  }
  ctx.stroke(); ctx.restore();
}

/** Namensschild wie "Das ist ein Biofilter": springt rein, bleibt kurz. */
function tag(label, x, y, t, t0, o = {}) {
  const k = ease(t, t0, .35, E.outBack);
  if (k <= 0) return;
  const out = o.hold ? 1 : 1 - prog(t, t0 + (o.dur || 2.2), t0 + (o.dur || 2.2) + .3);
  if (out <= 0) return;
  ctx.save(); ctx.translate(x, y); ctx.scale(k, k); ctx.globalAlpha *= out;
  ctx.font = `900 ${o.size || 44}px Inter`; ctx.letterSpacing = '3px';
  const w = ctx.measureText(label).width + 56, h = (o.size || 44) + 34;
  ctx.fillStyle = o.bg || '#ffd23f'; rr(-w / 2, -h / 2, w, h, 14); ctx.fill();
  ctx.fillStyle = o.color || '#0b1a2e'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(label, 0, 3);
  ctx.restore();
}

/** Sprechblase (Comic). */
function bubble(s, x, y, t, t0, t1, o = {}) {
  if (t < t0 || t > t1 + .25) return;
  const k = ease(t, t0, .25, E.outBack) * (1 - prog(t, t1, t1 + .25));
  ctx.save(); ctx.translate(x, y); ctx.scale(k, k);
  ctx.font = `${o.weight || 700} ${o.size || 38}px Inter`;
  const w = ctx.measureText(s).width + 44, h = (o.size || 38) + 34;
  const off = clamp(x, w / 2 + 16, W - w / 2 - 16) - x; // Blase bleibt im Bild, Spitze bleibt am Sprecher
  ctx.fillStyle = o.bg || '#fff'; ctx.strokeStyle = o.border || '#111'; ctx.lineWidth = 4;
  rr(off - w / 2, -h, w, h, 16); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-14, -2); ctx.lineTo(0, 22); ctx.lineTo(14, -2); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.moveTo(-14, 0); ctx.lineTo(0, 22); ctx.lineTo(14, 0); ctx.stroke();
  ctx.fillStyle = o.color || '#111'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(s, off, -h / 2 + 2);
  ctx.restore();
}

/** Batterie-Anzeige 0..1 (grün -> gelb -> rot). */
function battery(x, y, level, o = {}) {
  const w = o.w || 110, h = o.h || 50, seg = o.seg || 5;
  ctx.save(); ctx.translate(x - w / 2, y - h / 2); ctx.globalAlpha *= (o.alpha ?? 1);
  ctx.strokeStyle = o.frame || '#e8e8e8'; ctx.lineWidth = 5; rr(0, 0, w, h, 8); ctx.stroke();
  ctx.fillStyle = o.frame || '#e8e8e8'; rr(w + 2, h * .3, 9, h * .4, 3); ctx.fill();
  const col = level > .55 ? '#3ddc84' : level > .25 ? '#ffc93c' : '#ff4d4d';
  const n = Math.ceil(clamp(level) * seg - 1e-6);
  const gw = (w - 14 - (seg - 1) * 4) / seg;
  for (let i = 0; i < n; i++) { ctx.fillStyle = col; rr(7 + i * (gw + 4), 7, gw, h - 14, 3); ctx.fill(); }
  ctx.restore();
}

/** Strichmännchen. pose: {lean, armL, armR, legL, legR, headTilt} in Radiant; scale über s. */
function stick(x, y, s, pose = {}, o = {}) {
  const c = o.color || '#f4f4f4', lw = (o.lw || 9) * s;
  ctx.save(); ctx.translate(x, y); ctx.scale(1, 1); ctx.globalAlpha *= (o.alpha ?? 1);
  ctx.strokeStyle = c; ctx.fillStyle = c; ctx.lineWidth = lw; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  const L = 70 * s; // Segmentlänge
  const hipY = -(pose.hipH ?? 2 * L);
  const lean = pose.lean || 0;
  const neck = [Math.sin(lean) * L * 1.5, hipY - Math.cos(lean) * L * 1.5];
  // Beine (Knie + Fuß)
  const leg = (a1, a2, dir) => {
    const knee = [Math.sin(a1) * L, hipY + Math.cos(a1) * L];
    const foot = [knee[0] + Math.sin(a2) * L, knee[1] + Math.cos(a2) * L];
    ctx.beginPath(); ctx.moveTo(0, hipY); ctx.lineTo(...knee); ctx.lineTo(...foot); ctx.stroke();
  };
  leg(pose.legL1 ?? -.12, pose.legL2 ?? -.05);
  leg(pose.legR1 ?? .12, pose.legR2 ?? .05);
  ctx.beginPath(); ctx.moveTo(0, hipY); ctx.lineTo(...neck); ctx.stroke();
  const arm = (a1, a2) => {
    const sh = [neck[0] * .92, neck[1] + L * .15];
    const el = [sh[0] + Math.sin(a1) * L * .85, sh[1] + Math.cos(a1) * L * .85];
    const ha = [el[0] + Math.sin(a2) * L * .8, el[1] + Math.cos(a2) * L * .8];
    ctx.beginPath(); ctx.moveTo(...sh); ctx.lineTo(...el); ctx.lineTo(...ha); ctx.stroke();
    return ha;
  };
  const hL = arm(pose.armL1 ?? -.35, pose.armL2 ?? -.15);
  const hR = arm(pose.armR1 ?? .35, pose.armR2 ?? .15);
  const hr = 30 * s;
  const head = [neck[0] + Math.sin(lean) * hr * 1.05, neck[1] - Math.cos(lean) * hr * 1.05];
  ctx.beginPath(); ctx.arc(head[0], head[1], hr, 0, Math.PI * 2); ctx.fill();
  if (o.face) drawFace(head[0], head[1], hr, o.face, o.faceColor || '#111');
  ctx.restore();
  return { head: [x + head[0], y + head[1]], handL: [x + hL[0], y + hL[1]], handR: [x + hR[0], y + hR[1]], neck: [x + neck[0], y + neck[1]] };
}
function drawFace(x, y, r, mood, col) {
  ctx.save(); ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineWidth = r * .12; ctx.lineCap = 'round';
  const ex = r * .35, ey = -r * .15;
  if (mood === 'closed' || mood === 'tired') {
    line(x - ex - r * .12, y + ey, x - ex + r * .12, y + ey, col, r * .12); line(x + ex - r * .12, y + ey, x + ex + r * .12, y + ey, col, r * .12);
  } else {
    ctx.beginPath(); ctx.arc(x - ex, y + ey, r * .1, 0, 7); ctx.arc(x + ex, y + ey, r * .1, 0, 7); ctx.fill();
  }
  ctx.beginPath();
  if (mood === 'happy') ctx.arc(x, y + r * .1, r * .38, .15 * Math.PI, .85 * Math.PI);
  else if (mood === 'sad' || mood === 'tired') ctx.arc(x, y + r * .62, r * .32, 1.15 * Math.PI, 1.85 * Math.PI);
  else if (mood === 'strain') { ctx.moveTo(x - r * .3, y + r * .4); ctx.lineTo(x + r * .3, y + r * .4); }
  else if (mood === 'calm') ctx.arc(x, y + r * .2, r * .25, .2 * Math.PI, .8 * Math.PI);
  else { ctx.moveTo(x - r * .25, y + r * .42); ctx.lineTo(x + r * .25, y + r * .42); }
  ctx.stroke();
  if (mood === 'strain') { line(x - ex - r * .2, y + ey - r * .25, x - ex + r * .15, y + ey - r * .12, col, r * .1); line(x + ex + r * .2, y + ey - r * .25, x + ex - r * .15, y + ey - r * .12, col, r * .1); }
  ctx.restore();
}

/* ---------- Captions (Wort für Wort, wie in den Referenzvideos) ---------- */
const CAP = { y: 1380, size: 120, font: 'Anton', color: '#ffffff', accent: '#ffd23f', accentWords: [], stroke: 14,
  strokeColor: '#000000', upper: true, gap: .45, hideBeats: [] };
const ALL_WORDS = TL.beats.flatMap(b => b.words.map(w => ({ ...w, beat: b.id })));
function captions(t, o = {}) {
  const c = { ...CAP, ...o };
  let cur = null;
  for (let i = 0; i < ALL_WORDS.length; i++) {
    const w = ALL_WORDS[i], nx = ALL_WORDS[i + 1];
    const until = nx ? Math.min(nx.start, w.end + c.gap) : w.end + c.gap;
    if (t >= w.start && t < until) { cur = w; break; }
  }
  if (!cur && ALL_WORDS.length && t < ALL_WORDS[0].start && c.preroll !== false) cur = ALL_WORDS[0]; // 1. Frame nie ohne Text
  if (!cur || c.hideBeats.includes(cur.beat)) return;
  let s = cur.w.replace(/[„“"]/g, '');
  if (c.display) { const hit = Object.keys(c.display).find(k => norm(k) === norm(cur.w)); if (hit) s = c.display[hit]; } // z.B. Zahlwort -> Ziffern
  if (c.upper) s = s.toUpperCase();
  // Akzentgruppen: [{words:[...], color:'#hex'}]; accentWords/accent als Kurzform für eine Gruppe
  const groups = [...(c.accents || []), { words: c.accentWords, color: c.accent }];
  const grp = groups.find(g => g.words.some(a => norm(cur.w).startsWith(norm(a))));
  const accent = !!grp, accColor = grp ? grp.color : c.accent;
  const k = t < cur.start ? 1 : E.outBack(prog(t, cur.start, cur.start + .12));
  ctx.save(); ctx.translate(W / 2, c.y); const sc = .72 + .28 * k; ctx.scale(sc, sc);
  ctx.font = `${c.weight || 400} ${c.size}px ${c.font}`;
  let size = c.size; const maxW = c.maxWidth || 900;
  const mw = ctx.measureText(s).width; if (mw > maxW) { size = c.size * maxW / mw; ctx.font = `${c.weight || 400} ${size}px ${c.font}`; }
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
  if (c.stroke) { ctx.lineWidth = c.stroke; ctx.strokeStyle = c.strokeColor; ctx.strokeText(s, 0, 0); }
  ctx.fillStyle = accent ? accColor : c.color;
  if (accent && c.glow !== false) { ctx.shadowColor = accColor; ctx.shadowBlur = 30; }
  ctx.fillText(s, 0, 0);
  ctx.restore();
}

/* ---------- Satz-Untertitel (Stück für Stück, gesprochenes Wort hell) ---------- */
let _CHUNKS = null;
function phraseChunks(maxWords = 4, gapBreak = .07) { // Kokoro: Satzzeichen erzeugen kleine Lücken -> dort umbrechen
  if (_CHUNKS) return _CHUNKS;
  _CHUNKS = [];
  let cur = [];
  ALL_WORDS.forEach((w, i) => {
    const prev = ALL_WORDS[i - 1];
    const brk = cur.length && (cur.length >= maxWords || w.beat !== prev.beat || w.start - prev.end > gapBreak);
    if (brk) { _CHUNKS.push(cur); cur = []; }
    cur.push(w);
  });
  if (cur.length) _CHUNKS.push(cur);
  return _CHUNKS;
}
function phraseCaptions(t, o = {}) {
  const c = { y: 1450, size: 56, color: '#ffffff', dimColor: 'rgba(200,205,215,0.38)', maxWords: 4, hold: .35, ...o };
  const chunks = phraseChunks(c.maxWords);
  let ch = null;
  for (let i = 0; i < chunks.length; i++) {
    const a = chunks[i][0].start - .06, nx = chunks[i + 1];
    const b = Math.min(nx ? nx[0].start - .06 : 1e9, chunks[i][chunks[i].length - 1].end + c.hold);
    if (t >= a && t < b) { ch = chunks[i]; break; }
  }
  if (!ch && chunks.length && t < chunks[0][0].start) ch = chunks[0]; // 1. Frame nie ohne Text
  if (!ch) return;
  ctx.save(); ctx.font = `800 ${c.size}px Inter`; ctx.textBaseline = 'middle';
  const words = ch.map(w => (c.upper ? w.w.toUpperCase() : w.w));
  const sp = ctx.measureText(' ').width, widths = words.map(s => ctx.measureText(s).width);
  const total = widths.reduce((a, b) => a + b, 0) + sp * (words.length - 1);
  let x = W / 2 - total / 2;
  const k = t < ch[0].start - .06 ? 1 : E.outCubic(prog(t, ch[0].start - .06, ch[0].start + .15));
  ctx.globalAlpha *= k; ctx.translate(0, (1 - k) * 12);
  words.forEach((s, i) => {
    const on = t >= ch[i].start - .02;
    const acc = (c.accentWords || []).some(a => norm(ch[i].w).startsWith(norm(a)));
    ctx.fillStyle = on ? (acc ? (c.accent || c.color) : c.color) : c.dimColor;
    if (on && c.glow !== false) { ctx.shadowColor = acc ? (c.accent || 'rgba(255,255,255,.5)') : 'rgba(255,255,255,.35)'; ctx.shadowBlur = 18; } else ctx.shadowBlur = 0;
    ctx.textAlign = 'left'; ctx.fillText(s, x, c.y); x += widths[i] + sp;
  });
  ctx.restore();
}

/* ---------- Render-Hook ---------- */
window.seek = (t) => { ctx.save(); ctx.clearRect(0, 0, W, H); draw(ctx, t); ctx.restore(); };
window.frameData = (t, q = .9) => { window.seek(t); return canvas.toDataURL('image/jpeg', q); };
