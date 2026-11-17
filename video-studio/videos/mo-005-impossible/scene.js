/* Motivation #005 – "Impossible. Lucky. How?" (EN, Kokoro)
 * Stil: Glow-Kit (leuchtende Strichfiguren, nächtliche Berge, rote Spott-Chips, goldener Gipfel) + Satz-Untertitel.
 */
const T = {
  impossible: wt('h1', 'impossible'), laugh: wt('b1', 'laugh'), worries: wt('b1', 'worries'), tried: wt('b1', 'tried'), realistic: wt('b1', 'realistic'),
  fall: wt('b2', 'fall'), told: wt('b2', 'told'),
  nights: wt('b3', 'nights'), up: wt('b3', 'up'), alone: wt('b3', 'Alone'),
  make: wt('b4', 'make'), luck: wt('b4', 'luck'),
  later: wt('b5', 'later'), ask: wt('b5', 'ask'), how: wt('b5', 'how'),
  w1: wt('b6', 'Impossible'), w2: wt('b6', 'Lucky'), w3: wt('b6', 'How'),
  three: wt('b7', 'Three'), only: wt('b7', 'only'), changed: wt('b7', 'changed'),
};
const G = GL.ground;
const ZOOM = 1.25;

/* ---------- Helfer ---------- */
function yOn(pts, x) { for (let i = 1; i < pts.length; i++) if (x <= pts[i][0]) return lerp(pts[i - 1][1], pts[i][1], (x - pts[i - 1][0]) / (pts[i][0] - pts[i - 1][0])); return pts[pts.length - 1][1]; }
function scenes(t, list, fade = .3) {
  for (const [a, b, fn] of list) {
    if (t < a - fade || t > b + fade) continue;
    const k = clamp(Math.min((t - (a - fade)) / (2 * fade), ((b + fade) - t) / (2 * fade)));
    ctx.save(); ctx.globalAlpha = k;
    if (!fn.flat) { ctx.translate(540, 1000); ctx.scale(ZOOM, ZOOM); ctx.translate(-540, -1000); } // Hochformat: Bühne größer
    fn(t, k); ctx.restore();
  }
}

/* ---------- Szene A: Spott, Klettern, Sturz ---------- */
const CLIFF = [[-50, G], [812, G], [826, 1238], [842, 640], [1140, 640]];
const CROWD_X = [215, 300, 385, 470];
function sDoubters(t) {
  glowBackground(t);
  terrain(CLIFF);
  // Spötter
  const pointing = t > T.told - .2;
  CROWD_X.forEach((x, i) => {
    const p = pointing && i % 2 ? posePoint(x, G, 1) : poseLaugh(x, G, t * 9 + i);
    stickman(p, { s: .86, color: GL.mock, glow: 10 });
  });
  haPops(200, 500, 1000, t, -.6, 3.0, 4);
  haPops(200, 500, 1000, t, T.told - .2, T.told + 1.2, 9);
  // Held: stehen -> laufen -> klettern -> stürzen -> liegen
  const tw0 = T.realistic - .2, tw1 = tw0 + 1.0, tc1 = T.fall - .02, tf1 = T.fall + .55;
  let p;
  if (t < tw0) p = poseStand(640, G);
  else if (t < tw1) { const k = prog(t, tw0, tw1); p = poseWalk(lerp(640, 772, k), G, (t - tw0) * 10); }
  else if (t < tc1) { const k = E.inOutCubic(prog(t, tw1, tc1)); p = poseClimb(772, lerp(G - 112, 930, k), (t - tw1) * 11); }
  else if (t < tf1) { const k = E.inCubic(prog(t, tc1, tf1)); const a = poseClimb(772, 930, 0), b = poseLie(700, G); p = lerpPose(a, b, k); p.hy = lerp(930, G - 14, k); }
  else p = poseLie(700, G);
  stickman(p, { s: 1 });
  // Wörter und Chips
  const ki = ease(t, T.impossible - .05, .3, E.outBack) * (1 - ease(t, bs('b1') + .4, .5));
  if (ki > 0) { ctx.save(); ctx.translate(540, 700); ctx.rotate(-.06); ctx.scale(ki, ki); txt('IMPOSSIBLE', 0, 0, { font: 'Inter', weight: 900, size: 100, color: GL.red, glow: GL.red, glowBlur: 30, spacing: 2 }); ctx.restore(); }
  chip('ARE YOU SURE?', 330, 860, t, T.worries - .05, T.tried + .3, { color: '#c9ccd2' });
  chip("IT WON'T WORK.", 440, 800, t, T.tried - .05, T.realistic + .9);
  chip('BE REALISTIC.', 330, 930, t, T.realistic - .05, bs('b2') + .4);
  chip('TOLD YOU SO.', 360, 880, t, T.told - .05, 1e9);
}

/* ---------- Szene C: Nächte allein ---------- */
function sNights(t) {
  glowBackground(t, { top: '#0d0f14', mid: '#0a0b0f' });
  moon(820, 430, 1);
  terrain([[-50, G], [1140, G]]);
  const a0 = bs('b3'), a1 = T.up + .25;
  const zoom = lerp(1, .62, ease(t, T.alone - .1, 1.0, E.inOutCubic));
  ctx.save(); ctx.translate(540, G); ctx.scale(zoom, zoom); ctx.translate(-540, -G);
  coneLight(540, G, 1, lerp(460, 300, 1 - zoom));
  const cyc = .78, k = ((t - a0) / cyc) % 1, n = Math.floor((t - a0) / cyc);
  const tri = t < a1 ? Math.sin(k * Math.PI) : 0;
  stickman(lerpPose(poseStand(540, G), poseKneel(540, G), tri), {});
  // rote X für jeden Fehlschlag
  const r = rand(7);
  for (let i = 0; i <= n && i < 6; i++) {
    const x = 300 + r() * 480, y = 760 + r() * 280, at = a0 + i * cyc + cyc * .4;
    redX(x, y, ease(t, at, .25, E.outBack), 1 - prog(t, at + .9, at + 1.5));
  }
  ctx.restore();
  const nights = Math.round(lerp(1, 214, E.inOutCubic(prog(t, T.nights - .2, T.up))));
  txt(`NIGHT ${nights}`, 540, 600, { font: 'Inter', weight: 800, size: 34, color: '#8f95a0', spacing: 6, alpha: ease(t, T.nights - .3, .3) });
}

/* ---------- Szene D/E: Gipfel, "lucky", "how?" ---------- */
const MTN = [[-50, 1330], [200, 1290], [380, 1080], [470, 960], [540, 880], [610, 960], [760, 1120], [1140, 1300]];
function sSummit(t) {
  const sun = ease(t, T.make - .6, 1.6);
  glowBackground(t, { sun, sunAt: [540, 800] });
  terrain(MTN);
  // Held erreicht den Gipfel
  const a0 = bs('b4') - .2, a1 = T.make;
  let p;
  if (t < a1) { const k = prog(t, a0, a1), x = lerp(430, 535, k); p = poseWalk(x, yOn(MTN, x), (t - a0) * 9); }
  else p = lerpPose(poseStand(540, 880), poseCelebrate(540, 880), ease(t, a1, .4));
  stickman(p, { glowColor: mixColor('#f4f6fa', '#ffc861', sun), glow: 30 + 20 * sun });
  // Die anderen kommen nach
  const walk = E.inOutCubic(prog(t, T.later - .3, T.how + .4));
  [0, 1, 2].forEach(i => {
    const x = lerp(175 + i * 70, 270 + i * 60, walk), y = yOn(MTN, x);
    const q = walk > 0 && walk < 1 ? poseWalk(x, y, t * 8 + i) : t > T.how ? posePoint(x, y, 1) : poseStand(x, y);
    stickman(q, { s: .72, color: GL.crowd, glow: 8 });
  });
  chip('JUST LUCKY.', 290, 1130, t, T.luck - .05, bs('b5') + .2, { color: '#c9ccd2' });
  chip('HOW DID YOU DO IT?', 330, 860, t, T.ask - .05, 1e9, { color: '#f4f6fa' });
  chip('HOW?', 170, 960, t, T.how, 1e9, { color: '#f4f6fa', size: 26 });
  chip('HOW??', 420, 760, t, T.how + .25, 1e9, { color: '#f4f6fa', size: 26 });
}

/* ---------- Szene F: drei Wörter ---------- */
function sWords(t) {
  glowBackground(t, { top: '#0c0d11', mid: '#0a0b0e' });
  const words = [['IMPOSSIBLE.', T.w1, GL.red], ['LUCKY.', T.w2, '#b9bdc6'], ['HOW?', T.w3, '#ffffff']];
  words.forEach(([s, at, col], i) => {
    const k = ease(t, at - .05, .3, E.outBack); if (k <= 0) return;
    ctx.save(); ctx.translate(540, 780 + i * 150); ctx.scale(k, k);
    txt(s, 0, 0, { font: 'Inter', weight: 900, size: 118, color: col, glow: col, glowBlur: 24, spacing: 2 }); ctx.restore();
  });
}

/* ---------- Szene G: Schluss ---------- */
const PATH = [[150, 1560], [330, 1420], [250, 1300], [420, 1180], [370, 1070], [480, 960], [540, 885]];
function sFinal(t) {
  glowBackground(t, { sun: 1, sunAt: [540, 800] });
  terrain(MTN);
  const p = path(PATH), k = ease(t, bs('b7') - .1, 2.2, E.inOutCubic);
  ctx.save(); ctx.setLineDash([4, 16]); ctx.lineCap = 'round'; ctx.shadowColor = GL.gold; ctx.shadowBlur = 14;
  strokePath(p, k, GL.gold, 7); ctx.restore();
  PATH.slice(1, -1).forEach((q, i) => {
    if (k < (i + 1) / (PATH.length - 1)) return;
    line(q[0], q[1], q[0], q[1] - 46, '#e9ecf2', 4);
    ctx.save(); ctx.fillStyle = '#e9ecf2'; ctx.beginPath(); ctx.moveTo(q[0], q[1] - 46); ctx.lineTo(q[0] + 26, q[1] - 38); ctx.lineTo(q[0], q[1] - 30); ctx.fill(); ctx.restore();
  });
  stickman(poseStand(540, 880), { color: '#fff4dc', glowColor: GL.gold, glow: 50 });
}
/** Schlusstitel außerhalb des Zooms, über dem Gipfel. */
function finalTitles(t) {
  txt('IMPOSSIBLE  →  LUCKY  →  HOW?', 540, 380, { font: 'Inter', weight: 800, size: 30, color: '#9aa0aa', spacing: 4, alpha: ease(t, T.three - .1, .4) * (1 - ease(t, T.only - .2, .3)) });
  const l1 = ease(t, T.only - .05, .5), l2 = ease(t, T.changed - .05, .6);
  txt('THE ONLY THING THAT', 540, 300 + (1 - l1) * 16, { font: 'Inter', weight: 900, size: 56, color: '#f4f6fa', alpha: l1, spacing: 2 });
  txt('CHANGED WAS YOU.', 540, 395 + (1 - l2) * 16, { font: 'Inter', weight: 900, size: 84, color: GL.gold, alpha: l2, glow: GL.gold, glowBlur: 30, spacing: 1 });
}

const SCENES = [
  [0, bs('b3'), sDoubters], [bs('b3'), bs('b4'), sNights], [bs('b4'), bs('b6'), sSummit],
  [bs('b6'), bs('b7'), sWords], [bs('b7'), TL.duration + 1, sFinal],
];
sWords.flat = true;
function draw(ctx, t) {
  ctx.fillStyle = '#0a0b0e'; ctx.fillRect(0, 0, W, H);
  scenes(t, SCENES);
  finalTitles(t);
  glowFinish(t);
  if (t < T.only - .1 && !between(t, bs('b6') - .1, bs('b7'))) phraseCaptions(t, { y: 1480, size: 54, accentWords: ['impossible'], accent: GL.red });
}

function cues() {
  cue(0, 'riser', .2);
  cue(be('h1') + .05, 'impact', .55);
  [T.worries, T.tried, T.realistic].forEach(x => cue(x + .35, 'pop', .25));
  cue(T.fall + .1, 'whoosh', .4); cue(T.fall + .6, 'impact', .45); cue(be('b2') + .05, 'pop', .3);
  cue(bs('b3'), 'heartbeat', .3); cue(bs('b3') + 1.1, 'heartbeat', .25);
  for (let i = 0; i < 3; i++) cue(bs('b3') + i * .78 + .35, 'fail', .15);
  cue(T.make - .9, 'riser', .35); cue(T.make + .35, 'ding', .45);
  cue(T.luck + .35, 'pop', .3); cue(T.ask + .35, 'pop', .3); cue(T.how + .3, 'pop', .25);
  cue(be('b6') + .05, 'impact', .45);
  cue(be('b7') + .1, 'ding', .45);
}
