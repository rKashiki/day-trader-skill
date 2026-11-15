/* Motivation – Experiment 002 – "Who gets the yes?" (EN, Kokoro am_fenrir)
 * Format wie 001 v2 (Daten-Learnings): "Pick one"-Hook ab Frame 1, Ende direkt nach der Auflösung.
 * Vier Eigenschaften schicken je 50 Bewerbungen. Absagen fliegen als NO-Karten rein.
 * Twist: Fear verliert, bevor es losgeht. Curiosity startet am schwächsten und lädt sich an jeder Absage auf.
 */
const SERIES = 'EXPERIMENT 002  ·  REJECTION';
const C = { bg1: '#0c0c0f', bg2: '#16161c', fig: '#f2f2f2', grey: '#4d4d55', gold: '#f5c542', red: '#ff4d4d', green: '#3ddc84', dim: '#7c7c88', floor: '#2a2a33' };
const LANES = [
  { id: 'C', name: 'CONFIDENCE', x: 150 },
  { id: 'E', name: 'EGO', x: 383 },
  { id: 'F', name: 'FEAR', x: 616 },
  { id: 'Q', name: 'CURIOSITY', x: 849 },
];
const F = 1230; // Boden

/* ---------- Zeitmarken ---------- */
const T = {
  fearNever: wt('b1', 'never'), fearSend: wt('b1', 'send'),
  ego: wt('b2', 'Ego'), egoTakes: wt('b2', 'takes'), egoQuit: wt('b2', 'personally', 0, 'end'),
  conf: wt('b3', 'Confidence'), confQuit: wt('b3', 'fuel'),
  weakest: wt('b4', 'weakest'), question: wt('b4', 'question'), why: wt('b4', 'Why'),
  charges: wt('b5', 'charges'),
  yesWord: wt('b7', 'Yes'), yes: wt('b7', 'Yes', 0, 'end') - .05,
  hiC: wt('b8', 'Confidence'), hiQ: wt('b8', 'Curiosity'), frage: wt('b9', 'Which'),
};
const KEYS = [
  [bs('b2') - .05, wt('b2', '3', 0, 'end'), 3],
  [bs('b3') - .05, wt('b3', '10', 0, 'end'), 10],
  [wt('b4', 'every'), be('b5'), 30],
  [bs('b6') - .05, wt('b6', '49', 0, 'end'), 49],
];
function countF(t) {
  let prev = 0;
  for (const [a, b, v] of KEYS) {
    if (t >= b) { prev = v; continue; }
    if (t > a) return lerp(prev, v, E.inOutCubic(prog(t, a, b)));
    return prev;
  }
  return prev;
}
// Zeitpunkt, an dem Absage Nr. i eintrifft (einmal vorberechnet)
const HIT = [0];
for (let i = 1, t = 0; i <= 49; i++) { while (countF(t) < i - 1e-3 && t < TL.duration) t += 1 / 240; HIT[i] = t; }
const FLY = .32; // Flugzeit einer Karte
function receives(id, i) {
  if (id === 'F') return false;
  if (id === 'E') return i <= 3;
  if (id === 'C') return i <= 10;
  return true;
}
const received = (id, t) => { let n = 0; for (let i = 1; i <= 49; i++) if (receives(id, i) && HIT[i] + FLY <= t) n++; return n; };

/* ---------- Zustände ---------- */
function state(id, t) {
  const n = received(id, t);
  if (id === 'C') return { level: 1 - .09 * n, sit: ease(t, T.confQuit, .6, E.inOutCubic), quit: true, face: n >= 6 ? 'sad' : 'happy' };
  if (id === 'E') return { level: .8 - .17 * n, sit: ease(t, T.egoQuit, .6, E.inOutCubic), quit: true, face: t > T.egoTakes ? 'strain' : 'calm' };
  if (id === 'F') return { level: .6, sit: ease(t, T.fearNever, .6, E.inOutCubic), quit: true, face: 'tired' };
  let n1 = 0, n2 = 0;
  for (let i = 1; i <= 49; i++) if (HIT[i] + FLY <= t) (HIT[i] < T.why ? n1++ : n2++);
  return { level: clamp(.2 - .01 * n1 + .03 * n2), sit: 0, quit: false, face: t > T.yes ? 'happy' : t > T.why ? 'calm' : 'neutral', gold: ease(t, T.yes, .5) };
}

/* ---------- Figur (Frontansicht, stehend mit Umschlag / sitzend) ---------- */
function joints(x, k, bob) {
  const stand = {
    hip: [x, F - 165 + bob], kL: [x - 30, F - 82], kR: [x + 30, F - 82], fL: [x - 48, F], fR: [x + 48, F],
    neck: [x, F - 285 + bob], head: [x, F - 321 + bob], eL: [x - 46, F - 225 + bob], eR: [x + 46, F - 225 + bob],
    hL: [x - 52, F - 165 + bob], hR: [x + 52, F - 165 + bob],
  };
  const sit = {
    hip: [x, F - 30], kL: [x - 62, F - 95], kR: [x + 62, F - 95], fL: [x - 88, F], fR: [x + 88, F],
    neck: [x + 4, F - 138], head: [x + 8, F - 170], eL: [x - 48, F - 92], eR: [x + 48, F - 92], hL: [x - 66, F - 78], hR: [x + 66, F - 78],
  };
  const j = {};
  for (const n in stand) j[n] = [lerp(stand[n][0], sit[n][0], k), lerp(stand[n][1], sit[n][1], k)];
  return j;
}
function envelope(x, y, rot, col = '#ffffff', a = 1) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.globalAlpha *= a;
  ctx.fillStyle = col; rr(-26, -18, 52, 36, 4); ctx.fill();
  ctx.strokeStyle = '#9a9aa6'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-24, -15); ctx.lineTo(0, 4); ctx.lineTo(24, -15); ctx.stroke();
  ctx.restore();
}
function person(lane, t) {
  const st = state(lane.id, t);
  const bob = Math.sin(t * 2.4 + lane.x) * 3 * (1 - st.sit);
  const j = joints(lane.x, st.sit, bob);
  // kurzer Rückstoß bei jeder Absage
  let rec = 0;
  for (let i = 1; i <= 49; i++) if (receives(lane.id, i)) { const d = t - (HIT[i] + FLY); if (d >= 0 && d < .18) rec = Math.max(rec, 1 - d / .18); }
  for (const n of ['neck', 'head', 'eL', 'eR', 'hL', 'hR']) { j[n][0] += 7 * rec; j[n][1] -= 3 * rec; }
  const grey = st.quit ? st.sit : 0;
  const col = mixColor(C.fig, C.grey, grey);
  // Lichtkegel
  ctx.save(); const glow = st.gold ? C.gold : '#ffffff';
  const g = ctx.createRadialGradient(lane.x, F, 10, lane.x, F, 150);
  g.addColorStop(0, glow + (st.gold ? '66' : '22')); g.addColorStop(1, glow + '00');
  ctx.fillStyle = g; ctx.globalAlpha = 1 - grey * .8; ctx.fillRect(lane.x - 160, F - 150, 320, 220); ctx.restore();
  // Körper
  ctx.save(); ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineWidth = 11; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  const pl = (...pts) => { ctx.beginPath(); ctx.moveTo(...pts[0]); pts.slice(1).forEach(p => ctx.lineTo(...p)); ctx.stroke(); };
  pl([j.hip[0] - 14, j.hip[1]], j.kL, j.fL); pl([j.hip[0] + 14, j.hip[1]], j.kR, j.fR);
  pl(j.hip, j.neck);
  pl([j.neck[0] - 22, j.neck[1] + 12], j.eL, j.hL); pl([j.neck[0] + 22, j.neck[1] + 12], j.eR, j.hR);
  ctx.beginPath(); ctx.arc(j.head[0], j.head[1], 31, 0, 7); ctx.fill();
  ctx.restore();
  drawFace(j.head[0], j.head[1], 31, st.face, '#111');
  // Fear hält den nie abgeschickten Umschlag, die anderen ihren aktuellen
  if (lane.id !== 'Q' || t < T.yes) envelope(j.hR[0] + 14, j.hR[1] + 4, -.15 + .3 * st.sit, mixColor('#ffffff', '#77777f', grey));
  // Batterie
  const by = 838;
  const pulse = lane.id === 'Q' && between(t, T.weakest - .2, T.question) ? 1 + .12 * Math.sin((t - T.weakest) * 18) : 1;
  ctx.save(); ctx.translate(lane.x, by); ctx.scale(pulse, pulse);
  battery(0, 0, st.level, { alpha: 1 - grey * .4, frame: st.gold ? C.gold : '#e8e8e8' });
  ctx.restore();
  if (pulse !== 1) { ctx.save(); ctx.strokeStyle = C.red; ctx.lineWidth = 5; ctx.globalAlpha = .5 + .5 * Math.sin(t * 12); rr(lane.x - 82, by - 42, 164, 84, 14); ctx.stroke(); ctx.restore(); }
  if (lane.id === 'Q' && between(t, T.charges - .2, be('b6'))) txt('⚡', lane.x + 92, by - 2, { size: 46, color: C.gold, alpha: .6 + .4 * Math.sin(t * 20) });
  if (lane.id === 'F' && between(t, T.fearSend, T.fearSend + 2.2)) txt('UNUSED', lane.x, by - 52, { font: 'JetBrains Mono', weight: 800, size: 24, color: C.dim, alpha: ease(t, T.fearSend, .3) * (1 - prog(t, T.fearSend + 1.9, T.fearSend + 2.2)) });
  txt(lane.name, lane.x, F + 52, { font: 'JetBrains Mono', weight: 800, size: 27, color: st.gold ? C.gold : mixColor('#d9d9e0', '#55555e', grey), spacing: 1 });
}

/* ---------- Absage-Karten ---------- */
function card(x, y, rot, gold, s = 1, a = 1) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.scale(s, s); ctx.globalAlpha *= a;
  ctx.fillStyle = gold ? C.gold : '#ffffff'; ctx.strokeStyle = gold ? '#b8901f' : C.red; ctx.lineWidth = 4;
  rr(-40, -27, 80, 54, 8); ctx.fill(); ctx.stroke();
  txt(gold ? '?' : 'NO', 0, 2, { font: 'Anton', size: gold ? 40 : 34, color: gold ? '#111' : C.red });
  ctx.restore();
}
function cards(t) {
  for (const lane of LANES) {
    const rnd = rand(lane.x);
    for (let i = 1; i <= 49; i++) {
      const jitter = [rnd(), rnd(), rnd()];
      if (!receives(lane.id, i)) continue;
      const t0 = HIT[i], d = t - t0;
      if (d < 0) continue;
      const tx = lane.x + (jitter[0] - .5) * 40, ty = F - 250 + (jitter[1] - .5) * 60;
      const rot = (jitter[2] - .5) * .9;
      if (d < FLY) { // Anflug von oben rechts
        const k = E.outCubic(d / FLY);
        card(lerp(lane.x + 300, tx, k), lerp(560, ty, k), rot * k, false, .9);
        continue;
      }
      const after = d - FLY;
      const toGold = lane.id === 'Q' && t0 >= T.why;
      if (toGold) { // wird zur Frage und fliegt in die Batterie
        const k = E.inOutCubic(clamp(after / .45));
        if (k >= 1) continue;
        card(lerp(tx, lane.x, k), lerp(ty, 838, k), rot * (1 - k), after > .08, 1 - .6 * k, 1 - k * .3);
        continue;
      }
      // fällt auf den Stapel am Boden
      const k = E.inOutCubic(clamp(after / .5));
      const pileY = F - 14 - Math.min(i, 12) * 3, pileX = lane.x + 70 + (jitter[0] - .5) * 50;
      card(lerp(tx, pileX, k), lerp(ty, pileY, k), lerp(rot, (jitter[2] - .5) * .4 + 1.4, k) , false, lerp(.9, .55, k), lane.id === 'Q' && t > T.yes ? 1 - ease(t, T.yes, .4) : 1);
    }
  }
}

/* ---------- Bühne ---------- */
function background(t) {
  const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, C.bg1); g.addColorStop(1, C.bg2);
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  for (let i = 1; i < 4; i++) { const x = (LANES[i - 1].x + LANES[i].x) / 2; line(x, 720, x, F + 80, 'rgba(255,255,255,0.06)', 3); }
  line(40, F + 2, W - 40, F + 2, C.floor, 6);
}
function header(t) {
  txt(SERIES, W / 2, 250, { font: 'JetBrains Mono', weight: 700, size: 28, color: C.dim, spacing: 2 });
  txt('WHO GETS THE YES?', W / 2, 330, { font: 'Anton', weight: 400, size: 104, color: '#ffffff' });
}
function counter(t) {
  const n = Math.round(countF(t));
  const yes = ease(t, T.yes, .3, E.outBack);
  const counting = KEYS.some(([a, b]) => t > a && t < b);
  ctx.save(); ctx.translate(W / 2, 470); const k = counting ? 1.06 : 1; ctx.scale(k, k);
  ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
  const parts = t < T.yes ? [['REJECTIONS ', 70, C.dim, 18], [String(n), 150, '#ffffff', 0], [' / 50', 70, C.dim, 18]]
    : [['APPLICATION 50: ', 70, C.dim, 18], ['YES', 150, C.green, 0]];
  const widths = parts.map(([s, sz]) => { ctx.font = `400 ${sz}px Anton`; return ctx.measureText(s).width; });
  let x = -widths.reduce((a, b) => a + b, 0) / 2;
  parts.forEach(([s, sz, col, dy], i) => {
    ctx.font = `400 ${sz}px Anton`; ctx.fillStyle = col;
    if (col === C.green) { ctx.shadowColor = C.green; ctx.shadowBlur = 40 * yes; }
    ctx.fillText(s, x, dy); ctx.shadowBlur = 0; x += widths[i];
  });
  ctx.restore();
  ctx.save(); ctx.fillStyle = '#26262e'; rr(140, 570, 800, 14, 7); ctx.fill();
  ctx.fillStyle = t >= T.yes ? C.green : '#ff6b6b'; rr(140, 570, 800 * (t >= T.yes ? 1 : n / 50), 14, 7); ctx.fill(); ctx.restore();
}
function yesStamp(t) {
  if (t < T.yes) return;
  const k = ease(t, T.yes, .22, E.outBack);
  const move = ease(t, T.yes + 1.0, .5, E.inOutCubic);
  const x = lerp(540, 849, move), y = lerp(1000, 690, move), s = lerp(lerp(3, 1.5, k), .55, move);
  const a = 1 - ease(t, T.frage - .2, .2);
  if (a <= 0) return;
  ctx.save(); ctx.translate(x, y); ctx.rotate(-.12); ctx.scale(s, s); ctx.globalAlpha = clamp(k * 2) * a;
  ctx.shadowColor = C.green; ctx.shadowBlur = 40;
  ctx.fillStyle = C.green; rr(-130, -62, 260, 124, 18); ctx.fill(); ctx.shadowBlur = 0;
  ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 8; rr(-118, -50, 236, 100, 12); ctx.stroke();
  txt('YES', 0, 4, { font: 'Anton', size: 92, color: '#ffffff' });
  ctx.restore();
}
function crown(x, y, k) {
  if (k <= 0) return;
  ctx.save(); ctx.translate(x, y); ctx.scale(k, k);
  ctx.fillStyle = C.gold; ctx.shadowColor = C.gold; ctx.shadowBlur = 30;
  ctx.beginPath(); ctx.moveTo(-50, 25); ctx.lineTo(-50, -15); ctx.lineTo(-25, 8); ctx.lineTo(0, -30); ctx.lineTo(25, 8); ctx.lineTo(50, -15); ctx.lineTo(50, 25); ctx.closePath(); ctx.fill();
  ctx.restore();
}
function laneHighlight(t) {
  const list = [['C', T.hiC, T.hiQ, 'RUNS OUT', C.red], ['Q', T.hiQ, T.frage, 'DATA', C.gold]];
  for (const [id, a, b, lbl, col] of list) {
    if (t < a || t > b) continue;
    const lane = LANES.find(l => l.id === id);
    const k = ease(t, a, .3, E.outBack) * (1 - prog(t, b - .2, b));
    ctx.save(); ctx.strokeStyle = col; ctx.lineWidth = 6; ctx.globalAlpha = clamp(k); ctx.shadowColor = col; ctx.shadowBlur = 25;
    rr(lane.x - 112, 740, 224, F - 740 + 85, 22); ctx.stroke(); ctx.restore();
    txt(lbl, lane.x, 702, { font: 'Inter', weight: 900, size: 34, color: col, alpha: clamp(k), spacing: 3 });
  }
  if (t >= T.frage) {
    numbers(t, T.frage, 1);
    txt('COMMENT YOUR NUMBER', W / 2, 630, { font: 'JetBrains Mono', weight: 800, size: 42, color: C.gold, alpha: ease(t, T.frage + .5, .4) });
  }
}
function numbers(t, t0, out) {
  LANES.forEach((l, i) => {
    const k = ease(t, t0 + i * .07, .3, E.outBack) * out;
    if (k <= 0) return;
    ctx.save(); ctx.translate(l.x, 700); ctx.scale(k, k);
    ctx.fillStyle = C.gold; ctx.beginPath(); ctx.arc(0, 0, 42, 0, 7); ctx.fill();
    txt(String(i + 1), 0, 4, { font: 'Anton', size: 58, color: '#111' }); ctx.restore();
  });
}
function hookPick(t) {
  const end = bs('b1');
  if (t > end) return;
  const out = 1 - prog(t, end - .35, end);
  numbers(t, -.6, out);
  txt('PICK ONE', W / 2, 630, { font: 'JetBrains Mono', weight: 800, size: 46, color: C.gold, alpha: out, spacing: 4 });
}
function midCta(t) {
  const a0 = bs('b5') + .1, a1 = a0 + 1.8;
  if (t < a0 || t > a1) return;
  const k = ease(t, a0, .3, E.outBack) * (1 - prog(t, a1 - .3, a1));
  ctx.save(); ctx.translate(W / 2, 645); ctx.scale(k, k);
  ctx.fillStyle = '#ffffff'; rr(-260, -30, 520, 60, 30); ctx.fill();
  txt('FOLLOW FOR EXPERIMENT 003', 0, 2, { font: 'Inter', weight: 900, size: 28, color: '#111', spacing: 2 });
  ctx.restore();
}

/* ---------- Frame ---------- */
function draw(ctx, t) {
  const z = lerp(1.07, 1, ease(t, 0, 1.1, E.outCubic));
  const [sx, sy] = between(t, T.yes, T.yes + .3) ? shake(t, 12, 60) : [0, 0];
  ctx.save(); ctx.translate(540 + sx, 960 + sy); ctx.scale(z, z); ctx.translate(-540, -960);
  background(t);
  header(t);
  counter(t);
  for (const lane of LANES) person(lane, t);
  cards(t);
  crown(LANES[3].x, 772, ease(t, T.yes + 1.3, .5, E.outBack) * (1 - ease(t, T.frage, .25)));
  const B = 795;
  bubble('What if they say no?', LANES[2].x, B, t, bs('b1') - .05, T.fearSend + .9, { size: 38 });
  bubble('Their loss.', LANES[1].x, B, t, T.ego, T.egoQuit + .8, { size: 38 });
  bubble('Maybe I’m not good enough…', LANES[0].x, B, t, T.conf, T.confQuit + 1.1, { size: 38 });
  bubble('Why?', LANES[3].x, B, t, T.why - .1, be('b5') - .3, { size: 44, bg: C.gold });
  midCta(t);
  laneHighlight(t);
  hookPick(t);
  yesStamp(t);
  ctx.restore();
  captions(t, {
    y: 1440, size: 128,
    accentWords: ['Pick', 'yes', 'Curiosity', 'question', 'Why', 'charges', 'data', 'number', '50'],
    accent: C.gold,
    accents: [{ words: ['Fear', 'Ego', 'Confidence', 'rejections', 'fuel', 'personally', 'weakest', 'Zero'], color: '#ff6b6b' }],
    display: { zero: '0' },
  });
  const f = ease(t, T.yes, .12) * (1 - prog(t, T.yes + .12, T.yes + .7));
  if (f > 0) { ctx.fillStyle = `rgba(61,220,132,${.25 * f})`; ctx.fillRect(0, 0, W, H); }
}

/* ---------- Sound ---------- */
function cues() {
  cue(0, 'riser', .3); for (let i = 0; i < 4; i++) cue(.05 + i * .07, 'pop', .3);
  for (let i = 1; i <= 49; i++) cue(HIT[i] + FLY - .02, i <= 10 ? 'pop' : 'tick', i <= 10 ? .35 : .3);
  cue(T.fearSend + .35, 'fail', .4); cue(T.egoQuit + .15, 'fail', .45); cue(T.confQuit + .35, 'fail', .45);
  cue(T.why + .35, 'pop', .5); cue(T.charges - .3, 'riser', .35);
  cue(bs('b5') + .1, 'pop', .35);
  cue(T.yes, 'impact', .9); cue(T.yes + .1, 'ding', .6);
  cue(T.hiC, 'pop', .4); cue(T.hiQ, 'pop', .45);
  for (let i = 0; i < 4; i++) cue(T.frage + i * .12, 'pop', .4);
}
