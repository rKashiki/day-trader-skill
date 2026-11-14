/* Motivation #001 – "Wer hält 365 Tage durch?"
 * Format: Experiment/Wettkampf. Vier personifizierte Eigenschaften, ein Tageszähler, Batterien.
 * Twist: Gewohnheit startet mit der schwächsten Batterie – und ist am Ende die einzige, die noch trainiert.
 */
const SERIES = 'EXPERIMENT 001  ·  DURCHHALTEN';
const C = { bg1: '#0c0c0f', bg2: '#16161c', fig: '#f2f2f2', grey: '#4d4d55', gold: '#f5c542', red: '#ff4d4d', dim: '#7c7c88', floor: '#2a2a33' };
const LANES = [
  { id: 'M', name: 'MOTIVATION', x: 150 },
  { id: 'T', name: 'TALENT', x: 383 },
  { id: 'D', name: 'DISZIPLIN', x: 616 },
  { id: 'G', name: 'GEWOHNHEIT', x: 849 },
];
const F = 1230; // Boden

/* ---------- Zeitmarken ---------- */
const T = {
  eins: wt('b1', 'eins'), motivB1: wt('b1', 'Motivation'),
  gew: wt('b2', 'Gewohnheit'), schwach: wt('b2', 'schwächste'),
  regnet: wt('b3', 'regnet'), mMotiv: wt('b3', 'Motivation'), mQuit: wt('b3', 'liegen'),
  talent: wt('b4', 'Talent'), tQuit: wt('b4', 'auf'), schwer: wt('b4', 'schwer'), langw: wt('b4', 'langweilig'),
  seltsam: wt('b5', 'Seltsames'), laedt: wt('b6', 'lädt'), allein: wt('b6', 'allein'),
  schnitt: wt('b7', 'sechsundsechzig'), automatik: wt('b7', 'Automatik'),
  dEnd: wt('b8', 'Disziplin'), ende: wt('b8', 'Ende'), uebern: wt('b9', 'übernimmt'), gewB9: wt('b9', 'Gewohnheit'),
  d365: wt('b10', 'dreihundertfünfundsechzig', 0, 'end'),
  hiM: wt('b11', 'Motivation'), hiD: wt('b11', 'Disziplin'), hiG: wt('b11', 'Aber'), musst: wt('b11', 'musst'),
  frage: wt('b12', 'Welcher'),
};
const DAYKEYS = [
  [bs('b3') - .05, wt('b3', 'zwölf', 0, 'end'), 12],
  [bs('b4') - .05, wt('b4', 'neununddreißig', 0, 'end'), 39],
  [bs('b5') - .05, wt('b5', 'sechsundsechzig', 0, 'end'), 66],
  [bs('b8') - .05, wt('b8', 'hundertachtzig', 0, 'end'), 180],
  [bs('b10') - .05, wt('b10', 'dreihundertfünfundsechzig', 0, 'end'), 365],
];
function dayF(t) {
  let prev = 1;
  for (const [a, b, v] of DAYKEYS) {
    if (t >= b) { prev = v; continue; }
    if (t > a) return lerp(prev, v, E.inOutCubic(prog(t, a, b)));
    return prev;
  }
  return prev;
}
/** Zusätzliche Wiederholungen während der Zeitraffer-Phasen. */
function ffwd(t) { return DAYKEYS.reduce((s, [a, b]) => s + prog(t, a, b), 0); }

/* ---------- Zustände ---------- */
function state(id, t) {
  const day = dayF(t);
  if (id === 'M') return { level: t >= T.mQuit ? 0 : clamp(1 - (day - 1) / 11.5) * (1 - .0 * t), sit: ease(t, T.mQuit, .5, E.inOutCubic), freq: 1.25, depth: 1, face: t > T.mMotiv - .5 ? 'sad' : 'happy' };
  if (id === 'T') return { level: Math.min(.8 - .25 * clamp((day - 1) / 38), 1), sit: ease(t, T.tQuit, .5, E.inOutCubic), freq: 1.1, depth: .9, face: t > T.talent ? 'tired' : 'calm' };
  if (id === 'D') {
    const lvl = .8 - .65 * clamp((day - 1) / 179) + .3 * ease(t, T.uebern + .6, 3);
    return { level: lvl, sit: ease(t, T.uebern, .8, E.inOutCubic), freq: .85, depth: 1, face: t > T.uebern + .4 ? 'happy' : day > 150 ? 'strain' : 'neutral', shake: t > T.dEnd - .3 && t < T.uebern + .3 ? 4 : 0 };
  }
  const base = .1 + .15 * clamp((day - 1) / 65);
  const lvl = lerp(base, 1, ease(t, T.laedt, 1.4, E.inOutCubic));
  return { level: lvl, sit: 0, freq: t < T.laedt ? .55 : .85, depth: t < T.laedt ? .55 : .95, face: t > T.laedt ? 'calm' : 'neutral', gold: ease(t, T.d365, .6) };
}

/* ---------- Strichmännchen mit Langhantel (Frontansicht) ---------- */
function joints(x, s, d, k) {
  // stehend/kniebeuge (d 0..1) und sitzend (k 0..1) werden überblendet
  const h = lerp(165, 100, d) * s, neckY = F - h - 120 * s;
  const stand = {
    hip: [x, F - h], kL: [x - lerp(40, 80, d) * s, F - h * .5 - 4 * s], kR: [x + lerp(40, 80, d) * s, F - h * .5 - 4 * s],
    fL: [x - 48 * s, F], fR: [x + 48 * s, F], neck: [x, neckY], head: [x, neckY - 36 * s],
    eL: [x - 64 * s, neckY + 46 * s], eR: [x + 64 * s, neckY + 46 * s], hL: [x - 72 * s, neckY + 6 * s], hR: [x + 72 * s, neckY + 6 * s],
    bar: [x, neckY + 6 * s],
  };
  const sit = {
    hip: [x, F - 30 * s], kL: [x - 62 * s, F - 95 * s], kR: [x + 62 * s, F - 95 * s], fL: [x - 88 * s, F], fR: [x + 88 * s, F],
    neck: [x + 4 * s, F - 30 * s - 108 * s], head: [x + 8 * s, F - 30 * s - 140 * s],
    eL: [x - 48 * s, F - 92 * s], eR: [x + 48 * s, F - 92 * s], hL: [x - 66 * s, F - 78 * s], hR: [x + 66 * s, F - 78 * s],
    bar: [x, F - 10 * s],
  };
  const j = {};
  for (const n in stand) j[n] = [lerp(stand[n][0], sit[n][0], k), lerp(stand[n][1], sit[n][1], k)];
  return j;
}
function lifter(lane, t) {
  const st = state(lane.id, t), s = 1;
  const ph = st.freq * t + lane.x * .003 + 2.2 * ffwd(t);
  const d = st.depth * (1 - Math.cos(ph * 2 * Math.PI)) / 2 * (1 - st.sit);
  const j = joints(lane.x, s, d, st.sit);
  if (st.shake) { const [sx, sy] = shake(t, st.shake, 47, lane.x); for (const n of ['neck', 'head', 'eL', 'eR', 'hL', 'hR', 'bar']) { j[n][0] += sx; j[n][1] += sy; } }
  const quit = lane.id === 'M' || lane.id === 'T' ? st.sit : 0;
  const col = mixColor(C.fig, C.grey, quit);
  // Lichtkegel am Boden
  ctx.save(); const glow = st.gold ? C.gold : '#ffffff';
  const g = ctx.createRadialGradient(lane.x, F, 10, lane.x, F, 150);
  g.addColorStop(0, glow + (st.gold ? '66' : '22')); g.addColorStop(1, glow + '00');
  ctx.fillStyle = g; ctx.globalAlpha = 1 - quit * .8; ctx.fillRect(lane.x - 160, F - 150, 320, 220); ctx.restore();
  // Hantel (hinter dem Körper)
  const bw = 98 * s;
  ctx.save(); ctx.strokeStyle = mixColor('#9a9aa6', '#55555e', quit); ctx.lineWidth = 9 * s; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(j.bar[0] - bw, j.bar[1]); ctx.lineTo(j.bar[0] + bw, j.bar[1]); ctx.stroke();
  ctx.fillStyle = st.gold ? mixColor('#c9c9d2', C.gold, st.gold) : mixColor('#c9c9d2', '#55555e', quit);
  for (const sx of [-1, 1]) { rr(j.bar[0] + sx * bw - 9 * s - (sx > 0 ? 0 : 0), j.bar[1] - 36 * s, 18 * s, 72 * s, 5); ctx.fill(); }
  ctx.restore();
  // Körper
  ctx.save(); ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineWidth = 11 * s; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  const pl = (...pts) => { ctx.beginPath(); ctx.moveTo(...pts[0]); pts.slice(1).forEach(p => ctx.lineTo(...p)); ctx.stroke(); };
  pl([j.hip[0] - 14 * s, j.hip[1]], j.kL, j.fL); pl([j.hip[0] + 14 * s, j.hip[1]], j.kR, j.fR);
  pl(j.hip, j.neck);
  pl([j.neck[0] - 22 * s, j.neck[1] + 12 * s], j.eL, j.hL); pl([j.neck[0] + 22 * s, j.neck[1] + 12 * s], j.eR, j.hR);
  ctx.beginPath(); ctx.arc(j.head[0], j.head[1], 31 * s, 0, 7); ctx.fill();
  ctx.restore();
  drawFace(j.head[0], j.head[1], 31 * s, st.face, '#111');
  if (st.shake && t > T.ende) { // Schweiß
    for (let i = 0; i < 2; i++) { const k = ((t * 1.4 + i * .5) % 1); ctx.save(); ctx.globalAlpha = 1 - k; ctx.fillStyle = '#7fd4ff'; ctx.beginPath(); ctx.arc(j.head[0] + (i ? 34 : -34), j.head[1] - 10 + k * 40, 6, 0, 7); ctx.fill(); ctx.restore(); }
  }
  // Batterie über dem Kopf
  const by = 838;
  const pulse = lane.id === 'G' && between(t, T.schwach - .2, be('b2') + .3) ? 1 + .12 * Math.sin((t - T.schwach) * 18) : 1;
  ctx.save(); ctx.translate(lane.x, by); ctx.scale(pulse, pulse);
  battery(0, 0, st.level, { alpha: 1 - quit * .4, frame: st.gold ? C.gold : '#e8e8e8' });
  ctx.restore();
  if (lane.id === 'G' && pulse !== 1) { ctx.save(); ctx.strokeStyle = C.red; ctx.lineWidth = 5; rr(lane.x - 82, by - 42, 164, 84, 14); ctx.globalAlpha = .5 + .5 * Math.sin(t * 12); ctx.stroke(); ctx.restore(); }
  // Ladeblitz, wenn sich Gewohnheit "von allein" auflädt
  if (lane.id === 'G' && between(t, T.laedt, T.laedt + 1.6)) txt('⚡', lane.x + 92, by - 2, { size: 46, color: C.gold, alpha: .6 + .4 * Math.sin(t * 20) });
  // Name
  txt(lane.name, lane.x, F + 52, { font: 'JetBrains Mono', weight: 800, size: 27, color: st.gold ? C.gold : mixColor('#d9d9e0', '#55555e', quit), spacing: 1 });
  return j;
}
function crown(x, y, k) {
  if (k <= 0) return;
  ctx.save(); ctx.translate(x, y); ctx.scale(k, k);
  ctx.fillStyle = C.gold; ctx.shadowColor = C.gold; ctx.shadowBlur = 30;
  ctx.beginPath(); ctx.moveTo(-50, 25); ctx.lineTo(-50, -15); ctx.lineTo(-25, 8); ctx.lineTo(0, -30); ctx.lineTo(25, 8); ctx.lineTo(50, -15); ctx.lineTo(50, 25); ctx.closePath(); ctx.fill();
  ctx.restore();
}

/* ---------- Bühne ---------- */
function background(t) {
  const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, C.bg1); g.addColorStop(1, C.bg2);
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  // Bahnen
  for (let i = 1; i < 4; i++) { const x = (LANES[i - 1].x + LANES[i].x) / 2; line(x, 720, x, F + 80, 'rgba(255,255,255,0.06)', 3); }
  line(40, F + 2, W - 40, F + 2, C.floor, 6);
}
function header(t) {
  txt(SERIES, W / 2, 250, { font: 'JetBrains Mono', weight: 700, size: 28, color: C.dim, spacing: 2 });
  txt('WER HÄLT 365 TAGE DURCH?', W / 2, 330, { font: 'Anton', weight: 400, size: 84, color: '#ffffff' });
}
function counter(t) {
  const d = Math.max(1, Math.round(dayF(t)));
  const done = ease(t, T.d365, .4);
  const counting = DAYKEYS.some(([a, b]) => t > a && t < b);
  const k = counting ? 1.06 : 1;
  ctx.save(); ctx.translate(W / 2, 470); ctx.scale(k, k);
  ctx.font = '400 150px Anton'; ctx.textBaseline = 'middle';
  const label = 'TAG ', num = String(d);
  ctx.font = '400 70px Anton'; const wl = ctx.measureText(label).width;
  ctx.font = '400 150px Anton'; const wn = ctx.measureText(num).width;
  ctx.font = '400 70px Anton'; const ws = ctx.measureText(' / 365').width;
  let x = -(wl + wn + ws) / 2;
  ctx.textAlign = 'left';
  ctx.font = '400 70px Anton'; ctx.fillStyle = C.dim; ctx.fillText(label, x, 18); x += wl;
  ctx.font = '400 150px Anton'; ctx.fillStyle = mixColor('#ffffff', C.gold, done); if (done) { ctx.shadowColor = C.gold; ctx.shadowBlur = 40 * done; }
  ctx.fillText(num, x, 0); x += wn; ctx.shadowBlur = 0;
  ctx.font = '400 70px Anton'; ctx.fillStyle = C.dim; ctx.fillText(' / 365', x, 18);
  ctx.restore();
  // Fortschrittsbalken
  ctx.save(); ctx.fillStyle = '#26262e'; rr(140, 570, 800, 14, 7); ctx.fill();
  ctx.fillStyle = done ? C.gold : '#ffffff'; rr(140, 570, 800 * d / 365, 14, 7); ctx.fill(); ctx.restore();
}
function rain(t) {
  const a0 = T.regnet - .15, a1 = bs('b4') + .2;
  if (t < a0 || t > a1) return;
  const a = ease(t, a0, .3) * (1 - prog(t, a1 - .3, a1));
  const rnd = rand(3);
  ctx.save(); ctx.strokeStyle = 'rgba(160,190,255,0.5)'; ctx.lineWidth = 3; ctx.globalAlpha = a;
  for (let i = 0; i < 110; i++) {
    const x0 = rnd() * (W + 300), sp = 1600 + rnd() * 700, ph = rnd() * 2000;
    const y = ((t * sp + ph) % (H + 200)) - 100, x = x0 - y * .25;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - 12, y + 48); ctx.stroke();
  }
  ctx.fillStyle = 'rgba(20,30,60,0.25)'; ctx.fillRect(0, 0, W, H);
  ctx.restore();
}
function laneHighlight(t) {
  const list = [['M', T.hiM, T.hiD], ['D', T.hiD, T.hiG], ['G', T.hiG, T.frage]];
  for (const [id, a, b] of list) {
    if (t < a || t > b) continue;
    const lane = LANES.find(l => l.id === id);
    const k = ease(t, a, .3, E.outBack) * (1 - prog(t, b - .2, b));
    ctx.save(); ctx.strokeStyle = C.gold; ctx.lineWidth = 6; ctx.globalAlpha = clamp(k); ctx.shadowColor = C.gold; ctx.shadowBlur = 25;
    rr(lane.x - 112, 740, 224, F - 740 + 85, 22); ctx.stroke(); ctx.restore();
    const lbl = { M: 'START', D: 'HARTE TAGE', G: 'ZIEL' }[id];
    txt(lbl, lane.x, 702, { font: 'Inter', weight: 900, size: 34, color: C.gold, alpha: clamp(k), spacing: 3 });
  }
  if (t >= T.frage) {
    LANES.forEach((l, i) => {
      const k = ease(t, T.frage + i * .12, .35, E.outBack);
      if (k <= 0) return;
      ctx.save(); ctx.translate(l.x, 700); ctx.scale(k, k);
      ctx.fillStyle = C.gold; ctx.beginPath(); ctx.arc(0, 0, 42, 0, 7); ctx.fill();
      txt(String(i + 1), 0, 4, { font: 'Anton', size: 58, color: '#111' }); ctx.restore();
    });
    txt('SCHREIB 1, 2, 3 ODER 4 IN DIE KOMMENTARE', W / 2, 640, { font: 'JetBrains Mono', weight: 800, size: 30, color: C.gold, alpha: ease(t, T.frage + .5, .4) });
  }
}
function midCta(t) {
  const a0 = bs('b8') + .2, a1 = a0 + 1.8;
  if (t < a0 || t > a1) return;
  const k = ease(t, a0, .3, E.outBack) * (1 - prog(t, a1 - .3, a1));
  ctx.save(); ctx.translate(W / 2, 645); ctx.scale(k, k);
  ctx.fillStyle = '#ffffff'; rr(-260, -30, 520, 60, 30); ctx.fill();
  txt('FOLGEN FÜR EXPERIMENT 002', 0, 2, { font: 'Inter', weight: 900, size: 28, color: '#111', spacing: 2 });
  ctx.restore();
}

/* ---------- Frame ---------- */
function draw(ctx, t) {
  background(t);
  header(t);
  counter(t);
  const J = {};
  for (const lane of LANES) J[lane.id] = lifter(lane, t);
  crown(LANES[3].x, 772, ease(t, T.d365 + .1, .5, E.outBack) * (1 - ease(t, T.frage, .25)));
  // Sprechblasen
  const B = 795;
  bubble('Diesmal zieh ich’s durch!', LANES[0].x, B, t, T.motivB1, be('b1') + .4, { size: 38 });
  bubble('Morgen wieder…', LANES[0].x, B, t, T.mMotiv - .2, T.mQuit + 1, { size: 38 });
  bubble('Zu einfach.', LANES[1].x, B, t, T.talent, T.schwer, { size: 38 });
  bubble('Langweilig.', LANES[1].x, B, t, T.langw - .1, be('b4') + .3, { size: 38 });
  bubble('Ich muss. Ich muss.', LANES[2].x, B, t, T.dEnd - .2, T.uebern, { size: 38 });
  rain(t);
  midCta(t);
  laneHighlight(t);
  captions(t, {
    y: 1440, size: 128,
    accentWords: ['Gewohnheit', 'sechsundsechzig', 'Automatik', 'dreihundertfünfundsechzig', 'Ziel', 'Seltsames', 'allein', 'entscheiden'],
    accent: C.gold,
    display: { eins: '1', zwölf: '12', neununddreißig: '39', sechsundsechzig: '66', hundertachtzig: '180', dreihundertfünfundsechzig: '365' },
    accents: [{ words: ['Motivation', 'Talent', 'Disziplin', 'schwächste', 'Ende', 'liegen', 'langweilig'], color: '#ff6b6b' }],
  });
  const f = ease(t, T.d365, .15) * (1 - prog(t, T.d365 + .15, T.d365 + .7));
  if (f > 0) { ctx.fillStyle = `rgba(245,197,66,${.28 * f})`; ctx.fillRect(0, 0, W, H); }
}

/* ---------- Sound ---------- */
function cues() {
  cue(0, 'riser', .3); cue(T.eins, 'tick', .6); cue(T.motivB1, 'pop', .5);
  cue(T.schwach, 'fail', .3);
  for (const [a, b] of DAYKEYS) { const n = Math.max(3, Math.round((b - a) / .09)); for (let i = 0; i < n; i++) cue(a + (b - a) * i / n, 'tick', .35); }
  cue(T.regnet - .2, 'whoosh', .4); cue(T.mQuit + .25, 'fail', .5);
  cue(T.tQuit + .25, 'fail', .45); cue(T.langw + .4, 'pop', .4);
  cue(T.seltsam + .3, 'riser', .5); cue(T.laedt, 'riser', .35); cue(T.allein + .3, 'ding', .55);
  cue(T.automatik + .5, 'pop', .4);
  cue(bs('b8') + .2, 'pop', .35); cue(T.dEnd, 'heartbeat', .45); cue(T.dEnd + .8, 'heartbeat', .4);
  cue(T.uebern + .2, 'whoosh', .45);
  cue(T.d365 + .9, 'impact', .8); cue(T.d365 + 1.0, 'ding', .6);
  cue(T.hiM, 'pop', .4); cue(T.hiD, 'pop', .4); cue(T.hiG, 'pop', .45);
  cue(T.frage, 'pop', .4); cue(T.frage + .12, 'pop', .4); cue(T.frage + .24, 'pop', .4); cue(T.frage + .36, 'pop', .4);
}
