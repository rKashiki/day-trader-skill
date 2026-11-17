/* Motivation – Experiment 003 – "Who reaches the gold?" (wortlos, Musik kommt in der App dazu)
 * Vier Eigenschaften graben senkrechte Schächte, die Kamera folgt in die Tiefe.
 * Twist (Röntgenblick): Die Goldschicht liegt unter ALLEN Schächten. Ego hat 1 Meter davor aufgehört.
 */
const PXM = 34;               // Pixel pro Meter
const GOLD = 42;              // Tiefe der Goldschicht
const M = id => bs(id);       // Zeitmarken aus script.json
const LANES = [
  { id: 'M', name: 'MOTIVATION', x: 170 },
  { id: 'T', name: 'TALENT', x: 400 },
  { id: 'E', name: 'EGO', x: 630 },
  { id: 'C', name: 'CONSISTENCY', x: 860 },
];
const QUIT = { M: M('motQuit'), T: M('talQuit'), E: M('egoQuit'), C: 1e9 };
const SAY = { M: ['TOO SLOW.', M('motQuit') - 1.1], T: ['THIS IS HARD.', M('talRock') + .3], E: ['NOTHING HERE.', M('egoStop') + .2] };

/* ---------- Tiefe pro Figur (Meter) ---------- */
function depth(id, t) {
  if (id === 'M') return 6 * E.outCubic(prog(t, .4, M('motQuit')));
  if (id === 'T') return 19 * Math.pow(prog(t, .3, M('talRock')), .75);
  if (id === 'E') return 41 * prog(t, .4, M('egoStop'));
  // Consistency: gleichmäßig, im Fels langsamer
  if (t < 8.5) return 18 * prog(t, .5, 8.5);
  if (t < 12.5) return lerp(18, 22, prog(t, 8.5, 12.5));
  return lerp(22, GOLD, prog(t, 12.5, M('gold')));
}
const digging = (id, t) => t < (id === 'T' ? M('talQuit') : id === 'E' ? M('egoStop') : id === 'M' ? M('motQuit') : M('gold'));
const wy = m => m * PXM;

/* ---------- Kamera ---------- */
function camera(t) {
  const focus = Math.max(...LANES.map(l => depth(l.id, t)));
  let cam = Math.max(300, wy(focus)), z = 1, anchor = 1150;
  const r = ease(t, M('reveal'), 1.4, E.inOutCubic);
  cam = lerp(cam, wy(GOLD / 2 + 1), r); z = lerp(1, .5, r); anchor = lerp(1150, 1010, r);
  return { cam, z, anchor };
}

/* ---------- Erde ---------- */
function ground(t, reveal) {
  const top = wy(0), bot = wy(90);
  ctx.fillStyle = '#2b2c31'; ctx.fillRect(-600, top, 2280, bot - top);
  const r = rand(5);
  ctx.strokeStyle = 'rgba(255,255,255,0.05)'; ctx.lineWidth = 3;
  for (let m = 1.5; m < 90; m += 2.2) { ctx.beginPath(); for (let x = -600; x <= 1680; x += 60) ctx.lineTo(x, wy(m) + Math.sin(x / 90 + m) * 6); ctx.stroke(); }
  // Felsschicht
  ctx.fillStyle = '#1f2024'; ctx.fillRect(-600, wy(18.5), 2280, wy(22) - wy(18.5));
  ctx.strokeStyle = 'rgba(255,255,255,0.09)'; ctx.lineWidth = 3;
  for (let i = 0; i < 40; i++) { ctx.beginPath(); ctx.ellipse(-500 + r() * 2100, wy(18.8 + r() * 3), 20 + r() * 30, 12 + r() * 16, r(), 0, 7); ctx.stroke(); }
  // Goldschicht (beim Röntgenblick sichtbar)
  if (reveal > 0) {
    ctx.save(); ctx.globalAlpha = reveal;
    const g = ctx.createLinearGradient(0, wy(GOLD), 0, wy(GOLD + 3));
    g.addColorStop(0, 'rgba(255,200,80,.85)'); g.addColorStop(1, 'rgba(255,170,50,.25)');
    ctx.fillStyle = g; ctx.shadowColor = '#ffc04d'; ctx.shadowBlur = 40; ctx.fillRect(-600, wy(GOLD), 2280, wy(GOLD + 3) - wy(GOLD));
    ctx.restore();
  }
  // Oberfläche
  line(-600, top, 1680, top, 'rgba(220,225,235,.55)', 4);
}
function goldBurst(x, t) {
  const k = prog(t, M('gold'), M('gold') + .8); if (k <= 0) return;
  const y = wy(GOLD);
  ctx.save(); const g = ctx.createRadialGradient(x, y, 5, x, y, 260 * E.outCubic(k) + 40);
  g.addColorStop(0, 'rgba(255,205,90,.9)'); g.addColorStop(1, 'rgba(255,180,60,0)');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, 300, 0, 7); ctx.fill(); ctx.restore();
  const r = rand(17);
  for (let i = 0; i < 26; i++) {
    const a = -Math.PI * r(), sp = 140 + r() * 260, d = t - M('gold'); if (d < 0) continue;
    const px = x + Math.cos(a) * sp * d, py = y + Math.sin(a) * sp * d + 300 * d * d;
    ctx.fillStyle = '#ffd36b'; ctx.beginPath(); ctx.arc(px, py, 7, 0, 7); ctx.fill();
  }
}
function shaft(l, t, reveal) {
  const d = depth(l.id, t), x = l.x;
  ctx.fillStyle = '#121215'; ctx.fillRect(x - 58, 0, 116, wy(d) + 2);
  line(x - 58, 0, x - 58, wy(d), 'rgba(255,255,255,.12)', 3); line(x + 58, 0, x + 58, wy(d), 'rgba(255,255,255,.12)', 3);
  if (l.id === 'C' && t >= M('gold')) { // Gold am Schachtboden
    ctx.save(); ctx.shadowColor = '#ffc04d'; ctx.shadowBlur = 30; ctx.fillStyle = '#ffc861';
    ctx.beginPath(); ctx.moveTo(x - 58, wy(GOLD) + 4); ctx.lineTo(x + 58, wy(GOLD) + 4); ctx.lineTo(x + 30, wy(GOLD) - 14); ctx.lineTo(x - 26, wy(GOLD) - 18); ctx.closePath(); ctx.fill(); ctx.restore();
  }
}
function digger(l, t) {
  const d = depth(l.id, t), y = wy(d), quit = ease(t, QUIT[l.id], .6), gold = l.id === 'C' && t > M('gold');
  const col = mixColor('#f4f6fa', '#6c7078', quit);
  const pose = gold ? lerpPose(poseDig(l.x, y, 0), poseCelebrate(l.x, y), ease(t, M('gold') + .1, .4))
    : digging(l.id, t) ? poseDig(l.x, y, t * 11 + l.x)
      : lerpPose(poseStand(l.x, y), poseSit(l.x, y), quit);
  const h = stickman(pose, { s: .56, color: col, glow: gold ? 40 : 14, glowColor: gold ? '#ffc861' : col });
  if (!gold && quit < 1) { // Schaufel
    const [hx, hy] = h.handR; const ang = digging(l.id, t) ? .5 + .35 * Math.sin(t * 11 + l.x) : .2;
    ctx.save(); ctx.globalAlpha *= 1 - quit; ctx.strokeStyle = '#c9ccd2'; ctx.lineWidth = 5; ctx.lineCap = 'round';
    const ex = hx + Math.sin(ang) * 60, ey = hy + Math.cos(ang) * 60;
    ctx.beginPath(); ctx.moveTo(hx - Math.sin(ang) * 20, hy - Math.cos(ang) * 20); ctx.lineTo(ex, ey); ctx.stroke();
    ctx.fillStyle = '#c9ccd2'; ctx.beginPath(); ctx.ellipse(ex, ey + 8, 11, 15, -ang, 0, 7); ctx.fill(); ctx.restore();
  }
  if (digging(l.id, t)) { // Erdbrocken fliegen
    const r = rand(Math.floor(t * 8) + l.x);
    for (let i = 0; i < 4; i++) { const k = (t * 8) % 1; ctx.fillStyle = 'rgba(160,150,140,.8)'; ctx.fillRect(l.x - 40 + r() * 80, y - 20 - k * (40 + r() * 60), 7, 7); }
  }
  // Name + Tiefe am Kopf
  const [, hy] = h.head;
  txt(l.name, l.x, hy - 58, { font: 'Inter', weight: 800, size: 22, color: gold ? '#ffc861' : mixColor('#e6e8ee', '#6c7078', quit), spacing: 3 });
  txt(`${Math.floor(d)} m`, l.x, hy - 30, { font: 'JetBrains Mono', weight: 800, size: 24, color: gold ? '#ffc861' : quit > .5 ? '#6c7078' : '#9aa0aa' });
  if (SAY[l.id]) chip(SAY[l.id][0], clamp(l.x, 170, 900), hy - 110, t, SAY[l.id][1], QUIT[l.id] + .8, { size: 24 });
}
/** Röntgen-Beschriftung: wie weit jeder noch vom Gold entfernt war. */
function distances(t) {
  LANES.forEach((l, i) => {
    if (l.id === 'C') return;
    const k = ease(t, M('reveal') + .9 + i * .35, .5); if (k <= 0) return;
    const d = depth(l.id, t), left = GOLD - Math.floor(d), red = left <= 1;
    ctx.save(); ctx.globalAlpha *= k; ctx.setLineDash([10, 10]); ctx.strokeStyle = red ? GL.red : 'rgba(255,255,255,.6)'; ctx.lineWidth = 6;
    ctx.beginPath(); ctx.moveTo(l.x, wy(d) + 10); ctx.lineTo(l.x, wy(GOLD)); ctx.stroke(); ctx.restore();
    const ly = red ? wy(d) - 120 : (wy(d) + wy(GOLD)) / 2;
    txt(`${left} m TO GO`, l.x, ly, { font: 'Inter', weight: 900, size: 64, color: red ? GL.red : '#e6e8ee', alpha: k, glow: red ? GL.red : null, glowBlur: 20 });
  });
}
function numbers(t, t0, out = 1, y = -110) {
  LANES.forEach((l, i) => {
    const k = ease(t, t0 + i * .07, .3, E.outBack) * out; if (k <= 0) return;
    ctx.save(); ctx.translate(l.x, y); ctx.scale(k, k); ctx.fillStyle = '#f5c542'; ctx.beginPath(); ctx.arc(0, 0, 44, 0, 7); ctx.fill();
    txt(String(i + 1), 0, 4, { font: 'Anton', size: 60, color: '#111' }); ctx.restore();
  });
}

/* ---------- Frame ---------- */
function draw(ctx, t) {
  const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#15171c'); g.addColorStop(1, '#0c0d10');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  const { cam, z, anchor } = camera(t), reveal = ease(t, M('reveal') + .4, .8);
  ctx.save(); ctx.translate(540, anchor); ctx.scale(z, z); ctx.translate(-540, -cam);
  ground(t, reveal);
  LANES.forEach(l => shaft(l, t, reveal));
  goldBurst(860, t);
  LANES.forEach(l => digger(l, t));
  distances(t);
  numbers(t, -.6, 1 - ease(t, 2.6, .4), 110);
  if (t > M('ask')) numbers(t, M('ask'));
  ctx.restore();
  // dunkles Band hinter der Kopfzeile, damit die Welt darunter wegblendet
  const band = ctx.createLinearGradient(0, 0, 0, 600);
  band.addColorStop(0, 'rgba(13,14,17,1)'); band.addColorStop(.72, 'rgba(13,14,17,.97)'); band.addColorStop(1, 'rgba(13,14,17,0)');
  ctx.fillStyle = band; ctx.fillRect(0, 0, W, 600);
  // Kopfzeile (Bildschirm-Koordinaten)
  const hdr = 1 - ease(t, M('text1') - .4, .4);
  txt('EXPERIMENT 003  ·  DEPTH', 540, 250, { font: 'JetBrains Mono', weight: 700, size: 28, color: '#7c7f88', spacing: 2, alpha: hdr });
  txt('WHO REACHES THE GOLD?', 540, 330, { font: 'Anton', size: 96, color: '#ffffff', alpha: hdr });
  txt('PICK ONE', 540, 420, { font: 'JetBrains Mono', weight: 800, size: 44, color: '#f5c542', spacing: 4, alpha: 1 - ease(t, 2.6, .4) });
  const l1 = ease(t, M('text1'), .5), l2 = ease(t, M('text2'), .5);
  txt('MOST PEOPLE QUIT', 540, 300 + (1 - l1) * 14, { font: 'Inter', weight: 900, size: 76, color: '#ffffff', alpha: l1, spacing: 1 });
  txt('1 METER BEFORE THE GOLD.', 540, 395 + (1 - l2) * 14, { font: 'Inter', weight: 900, size: 64, color: '#ffc861', alpha: l2, glow: '#ffc861', glowBlur: 26 });
  txt('WHICH ONE ARE YOU?', 540, 1500, { font: 'JetBrains Mono', weight: 800, size: 44, color: '#f5c542', spacing: 3, alpha: ease(t, M('ask') + .3, .4) });
  // kurzer Blitz beim Gold
  const f = ease(t, M('gold'), .1) * (1 - prog(t, M('gold') + .1, M('gold') + .6));
  if (f > 0) { ctx.fillStyle = `rgba(255,200,90,${.3 * f})`; ctx.fillRect(0, 0, W, H); }
}

function cues() {
  for (let i = 0; i < 4; i++) cue(.05 + i * .07, 'pop', .3);
  for (let x = .4; x < M('gold'); x += .55) cue(x, 'tick', .14);
  [['motQuit', .45], ['talQuit', .45], ['egoQuit', .5]].forEach(([k, g]) => cue(M(k) + .1, 'fail', g));
  cue(M('talRock') + .1, 'pump', .35);
  cue(M('gold') - 1.6, 'riser', .45); cue(M('gold'), 'impact', .8); cue(M('gold') + .1, 'ding', .55);
  cue(M('reveal'), 'whoosh', .5); cue(M('reveal') + 1.2, 'heartbeat', .35);
  cue(M('text1'), 'pop', .35); cue(M('text2'), 'pop', .4);
  for (let i = 0; i < 4; i++) cue(M('ask') + i * .07, 'pop', .3);
}
