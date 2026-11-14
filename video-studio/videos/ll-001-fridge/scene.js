/* Load & Limit #001 – "Your fridge is heating your kitchen" (EN, Stimme: Kokoro am_fenrir)
 * Format: Problem-Lösungs-Kette. Jedes "But" = neues Problem, jedes "So" = neues Bauteil.
 * Am Ende steht ein beschrifteter Kühlschrank-Kreislauf, und die Pointe schließt den Hook.
 */
const BRAND = 'LOAD & LIMIT';
const UNIT = 'F'; // 'F' = Fahrenheit (US-Publikum), 'C' = Celsius
const fmtT = (c, d = 1) => UNIT === 'F' ? (c * 9 / 5 + 32).toFixed(d) + ' °F' : c.toFixed(d) + ' °C';
const C = {
  bg1: '#071224', bg2: '#0d2140', grid: 'rgba(90,150,230,0.09)', gridMaj: 'rgba(90,150,230,0.17)',
  line: '#d6e6ff', dim: '#6f8fbf', hot: '#ff4a2e', warm: '#ffa53c', cold: '#3cc8ff', vapor: '#c4ecff',
  gas: '#dfe9f5', ins: '#f2c14e', white: '#f4f8ff', ok: '#3ddc84',
};

/* ---------- Geometrie ---------- */
const BOX = { x: 170, y: 560, w: 460, h: 600 };
const evapPts = [[580, 640], [230, 640], [230, 700], [580, 700], [580, 760], [230, 760], [230, 820], [580, 820]];
const suctPts = [[580, 820], [700, 820], [700, 1215], [745, 1215]];
const compPts = [[745, 1215], [870, 1215], [870, 1150]];
const condPts = [[870, 1150], [870, 1090], [740, 1090], [740, 1030], [920, 1030], [920, 970], [740, 970], [740, 910], [920, 910],
  [920, 850], [740, 850], [740, 790], [920, 790], [920, 730], [740, 730], [740, 670], [920, 670], [920, 610], [800, 610]];
const capPts = [[800, 610], [800, 500], [580, 500], [580, 640]];
const P = { evap: path(evapPts), suct: path(suctPts), comp: path(compPts), cond: path(condPts), cap: path(capPts) };
// Abschnitte des Kreislaufs: Dichte (Teilchen pro px) bildet Flüssig/Gas ab
const SECTIONS = [
  { k: 'evap', dens: 0.8 }, { k: 'suct', dens: 0.5 }, { k: 'comp', dens: 0.5 }, { k: 'cond', dens: 1.1 }, { k: 'cap', dens: 1.4 },
];
let U_TOTAL = 0; SECTIONS.forEach(s => { s.u0 = U_TOTAL; s.len = P[s.k].total; U_TOTAL += s.len * s.dens; s.u1 = U_TOTAL; });

/* ---------- Zeitmarken (alle aus der Stimme abgeleitet) ---------- */
const T = {};
function times() {
  Object.assign(T, {
    falsch: wt('h2', 'wrong'), bau: wt('h2', 'build'),
    essen: wt('b1', 'food'), kiste: wt('b1', 'box'), also1: wt('b1', 'So'),
    aber1: wt('b2', 'But'), waerme: wt('b2', 'heat'), rein: wt('b2', 'walls'),
    daemm: wt('b3', 'insulate'), bremst: wt('b3', 'slows'), stoppt: wt('b3', 'But'), also3: wt('b3', 'So'),
    was5: wt('b5', 'What'), verdunst: wt('b5', 'evaporation'), friert: wt('b5', 'shiver'), pool: wt('b5', 'pool'),
    rohr: wt('b6', 'pipe'), fluess: wt('b6', 'liquid'), verdampft: wt('b6', 'boils'), also6: wt('b6', 'So'),
    saugt: wt('b7', 'sucks'), verdampfer: wt('b7', 'evaporator'),
    aber8: wt('b8', 'But'), gas8: wt('b8', 'gas'),
    also9: wt('b9', 'So'), pumpe: wt('b9', 'pump'), zusammen: wt('b9', 'squeezes'), heiss: wt('b9', 'hot'), kueche9: wt('b9', 'kitchen'), kompressor: wt('b9', 'compressor'),
    gitter: wt('b10', 'grid'), hitze: wt('b10', 'heat'), fluessig: wt('b10', 'liquid'), verfl: wt('b10', 'condenser'),
    roehr: wt('b11', 'super'), tube: wt('b11', 'tube'), druck: wt('b11', 'pressure'), eiskalt: wt('b11', 'ice'),
    vorn: wt('b12', 'starts'), glueck: wt('b13', 'Congrats'), gebaut: wt('b13', 'built'),
    aber14: wt('b14', 'But'), kaelte: wt('b14', 'cold'), schaufelt: wt('b14', 'shovels'), motor: wt('b14', 'Plus'),
    offene: wt('b15', 'leaving'), tuer: wt('b15', 'door'), kueche15: wt('b15', 'kitchen'), heizt: wt('b16', 'it', 1),
  });
}
times();

/* ---------- Hintergrund + Kopf ---------- */
function background(t) {
  const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, C.bg1); g.addColorStop(1, C.bg2);
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  const boost = 1 + 1.5 * (ease(t, T.bau, .4) * (1 - ease(t, T.bau + .8, .8))); // Blaupause "leuchtet auf"
  ctx.save(); ctx.lineWidth = 2;
  for (let x = 0; x <= W; x += 60) { ctx.strokeStyle = x % 300 === 0 ? C.gridMaj : C.grid; ctx.globalAlpha = Math.min(1, boost * .9); ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
  for (let y = 0; y <= H; y += 60) { ctx.strokeStyle = y % 300 === 0 ? C.gridMaj : C.grid; ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
  ctx.restore();
  // Vignette
  const v = ctx.createRadialGradient(W / 2, H * .45, 300, W / 2, H * .45, 1100);
  v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,0.55)'); ctx.fillStyle = v; ctx.fillRect(0, 0, W, H);
}
function header(t) {
  txt(`${BRAND}  ·  EVERYDAY PHYSICS #001`, W / 2, 250, { font: 'JetBrains Mono', weight: 700, size: 28, color: C.dim, spacing: 2 });
  const solved = t >= T.heizt;
  ctx.save(); ctx.font = '400 104px Anton'; ctx.textBaseline = 'middle';
  const a = 'FRIDGE = ', b = solved ? 'HEATER.' : 'HEATER?';
  const wa = ctx.measureText(a).width, wb = ctx.measureText(b).width, x0 = W / 2 - (wa + wb) / 2;
  ctx.textAlign = 'left'; ctx.fillStyle = C.white; ctx.fillText(a, x0, 330);
  ctx.fillStyle = solved ? C.hot : C.warm; if (solved) { ctx.shadowColor = C.hot; ctx.shadowBlur = 30; }
  ctx.fillText(b, x0 + wa, 330); ctx.restore();
}
/** PROBLEM/LÖSUNG-Pille: macht die Kette sichtbar. */
const PILLS = () => [
  [T.also1, 'FIX', C.ok], [T.aber1, 'PROBLEM', C.hot], [T.also3, 'FIX', C.ok], [T.stoppt, 'PROBLEM', C.hot],
  [T.also6, 'FIX', C.ok], [T.aber8, 'PROBLEM', C.hot], [T.also9, 'FIX', C.ok],
];
function pills(t) {
  if (t >= T.offene) return;
  let cur = null; for (const p of PILLS()) if (t >= p[0] && t < p[0] + 1.8) cur = p;
  if (!cur) return;
  const k = ease(t, cur[0], .25, E.outBack) * (1 - prog(t, cur[0] + 1.5, cur[0] + 1.8));
  ctx.save(); ctx.translate(W / 2, 425); ctx.scale(k, k);
  ctx.font = '900 34px Inter'; ctx.letterSpacing = '6px';
  const w = ctx.measureText(cur[1]).width + 60;
  ctx.fillStyle = cur[2]; rr(-w / 2, -30, w, 60, 30); ctx.fill();
  ctx.fillStyle = '#071224'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(cur[1], 3, 2);
  ctx.restore();
}

/* ---------- Hook: fertiger Kühlschrank + Küchenthermometer ---------- */
function thermometer(x, top, bot, level, col, label, value, alpha = 1) {
  ctx.save(); ctx.globalAlpha *= alpha;
  ctx.fillStyle = '#0b1a30'; ctx.strokeStyle = C.line; ctx.lineWidth = 5;
  rr(x - 22, top, 44, bot - top, 22); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.arc(x, bot + 30, 44, 0, 7); ctx.fill(); ctx.stroke();
  ctx.fillStyle = col; ctx.beginPath(); ctx.arc(x, bot + 30, 32, 0, 7); ctx.fill();
  const fy = lerp(bot, top + 20, clamp(level)); rr(x - 11, fy, 22, bot - fy + 20, 11); ctx.fill();
  for (let i = 0; i <= 8; i++) line(x + 26, lerp(bot - 10, top + 20, i / 8), x + (i % 2 ? 38 : 46), lerp(bot - 10, top + 20, i / 8), C.dim, 3);
  txt(label, x, top - 80, { font: 'JetBrains Mono', size: 30, color: C.dim, weight: 700 });
  txt(value, x, top - 36, { font: 'JetBrains Mono', size: 44, color: col, weight: 800 });
  ctx.restore();
}
function hookFridge(t) {
  const out = ease(t, T.bau, .7, E.inOutCubic);
  if (out >= 1) return;
  const glitch = between(t, T.falsch, T.falsch + .35);
  ctx.save(); ctx.globalAlpha = 1 - out; ctx.translate(0, -120 * out);
  const k = ease(t, 0, .45, E.outBack);
  ctx.translate(420, 915); ctx.scale(.85 + .15 * k, .85 + .15 * k); ctx.translate(-420, -915);
  // Hitze hinter dem Kühlschrank
  for (let i = 0; i < 6; i++) heatWave(660, 600 + i * 110, 120, 0, t, i * .37, C.hot, .9);
  for (let i = 0; i < 3; i++) heatWave(260 + i * 160, 520, 90, -Math.PI / 2, t, i * .5, C.hot, .7);
  const dx = glitch ? Math.sin(t * 90) * 14 : 0;
  for (const [ox, col, a] of glitch ? [[-dx, '#ff2a6d', .7], [dx, '#05d9e8', .7], [0, '#e9eef5', 1]] : [[0, '#e9eef5', 1]]) {
    ctx.save(); ctx.globalAlpha *= a; ctx.translate(ox, 0);
    ctx.fillStyle = col; rr(200, 540, 440, 750, 34); ctx.fill();
    ctx.restore();
  }
  ctx.strokeStyle = '#b8c4d4'; ctx.lineWidth = 6; line(206, 800, 634, 800, '#b8c4d4', 6);
  ctx.fillStyle = '#9aa8bb'; rr(590, 600, 18, 150, 9); ctx.fill(); rr(590, 850, 18, 230, 9); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,.5)'; rr(220, 560, 26, 700, 13); ctx.fill();
  ctx.restore();
  // Küchenthermometer
  const temp = 21 + 0.8 * ease(t, .2, 2.2, E.inOutCubic);
  thermometer(860, 640, 1060, .45 + (temp - 21) * .35, C.hot, 'KITCHEN', fmtT(temp), 1 - out);
  if (t < T.bau) arrow(930, 900, 930, 760 - 30 * Math.sin(t * 6), { color: C.hot, width: 10, glow: C.hot, alpha: ease(t, .4, .3) });
  if (glitch || between(t, T.falsch, T.bau)) {
    const q = ease(t, T.falsch, .2, E.outBack);
    txt('?', 420, 915, { font: 'Anton', size: 420 * q, color: C.hot, stroke: 16, strokeColor: '#071224', alpha: 1 - out });
  }
}
function heatWave(x, y, len, ang, t, ph, col, alpha = 1, speed = .9) {
  const k = ((t * speed + ph) % 1 + 1) % 1;
  ctx.save(); ctx.translate(x, y); ctx.rotate(ang); ctx.globalAlpha *= alpha * Math.sin(k * Math.PI);
  ctx.strokeStyle = col; ctx.lineWidth = 7; ctx.lineCap = 'round'; ctx.shadowColor = col; ctx.shadowBlur = 16;
  ctx.beginPath();
  const x0 = k * len * .8;
  for (let i = 0; i <= 20; i++) { const xx = x0 + i * len / 20 * .7; const yy = Math.sin(i / 20 * Math.PI * 3 - t * 8) * 10; i ? ctx.lineTo(xx, yy) : ctx.moveTo(xx, yy); }
  ctx.stroke(); ctx.restore();
}

/* ---------- Kiste, Essen, Dämmung ---------- */
function food(t) {
  const items = [
    { x: 270, kind: 'milk', d: 0 }, { x: 410, kind: 'apple', d: .12 }, { x: 530, kind: 'cheese', d: .24 },
  ];
  for (const it of items) {
    const k = ease(t, T.essen + it.d, .45, E.outBack);
    if (k <= 0) continue;
    const y = lerp(760, 1124, Math.min(1, k)) + (k > 1 ? (k - 1) * -60 : 0);
    ctx.save(); ctx.translate(it.x, y); ctx.globalAlpha *= clamp(k * 3);
    if (it.kind === 'milk') {
      ctx.fillStyle = '#f4f8ff'; rr(-40, -130, 80, 130, 6); ctx.fill();
      ctx.beginPath(); ctx.moveTo(-40, -130); ctx.lineTo(0, -165); ctx.lineTo(40, -130); ctx.fill();
      ctx.fillStyle = '#3c8dff'; ctx.fillRect(-40, -90, 80, 34);
    } else if (it.kind === 'apple') {
      ctx.fillStyle = '#ff4d5a'; ctx.beginPath(); ctx.arc(-14, -42, 36, 0, 7); ctx.arc(14, -42, 36, 0, 7); ctx.fill();
      line(0, -78, 6, -100, '#6b3e1f', 6); ctx.fillStyle = '#3ddc84'; ctx.beginPath(); ctx.ellipse(20, -96, 16, 8, -.5, 0, 7); ctx.fill();
    } else {
      ctx.fillStyle = '#ffd23f'; ctx.beginPath(); ctx.moveTo(-50, 0); ctx.lineTo(50, 0); ctx.lineTo(50, -70); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#e0a800'; [[25, -20, 9], [38, -45, 6], [10, -8, 5]].forEach(([a, b, r]) => { ctx.beginPath(); ctx.arc(a, b, r, 0, 7); ctx.fill(); });
    }
    ctx.restore();
  }
}
const boxPath = path([[BOX.x, BOX.y], [BOX.x + BOX.w, BOX.y], [BOX.x + BOX.w, BOX.y + BOX.h], [BOX.x, BOX.y + BOX.h], [BOX.x, BOX.y]]);
function doorAngle(t) { return -0.24 * ease(t, T.tuer - .1, .6, E.outBack); }
function box(t) {
  const draw = ease(t, T.kiste - .25, .6, E.inOutCubic);
  if (draw <= 0) return;
  const wT = 8 + 24 * ease(t, T.daemm, .7, E.outCubic);
  if (wT > 9) {
    const walls = [[BOX.x, BOX.y, BOX.w, wT], [BOX.x, BOX.y + BOX.h - wT, BOX.w, wT], [BOX.x + BOX.w - wT, BOX.y, wT, BOX.h]];
    walls.forEach(r => hatch(...r));
    ctx.save(); ctx.translate(BOX.x, BOX.y + BOX.h); ctx.rotate(doorAngle(t)); hatch(0, -BOX.h, wT, BOX.h); ctx.restore();
  }
  // Umriss (Tür-Seite links separat, damit sie aufgehen kann)
  ctx.save(); ctx.strokeStyle = C.line; ctx.lineWidth = 6; ctx.lineJoin = 'round';
  if (draw < 1) strokePath(boxPath, draw, C.line, 6);
  else {
    ctx.beginPath(); ctx.moveTo(BOX.x, BOX.y); ctx.lineTo(BOX.x + BOX.w, BOX.y); ctx.lineTo(BOX.x + BOX.w, BOX.y + BOX.h); ctx.lineTo(BOX.x, BOX.y + BOX.h); ctx.stroke();
    ctx.translate(BOX.x, BOX.y + BOX.h); ctx.rotate(doorAngle(t));
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -BOX.h); ctx.stroke();
    if (t > T.tuer - .1) { ctx.fillStyle = '#9aa8bb'; rr(-24, -BOX.h * .62, 14, 120, 7); ctx.fill(); }
  }
  ctx.restore();
}
function hatch(x, y, w, h) {
  ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
  ctx.fillStyle = '#1d3a63'; ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = 'rgba(242,193,78,.75)'; ctx.lineWidth = 3;
  for (let i = -h; i < w + h; i += 16) { ctx.beginPath(); ctx.moveTo(x + i, y); ctx.lineTo(x + i - h, y + h); ctx.stroke(); }
  ctx.restore();
}
/** Wärme, die durch die Wände kriecht (b2/b3). */
function leakArrows(t) {
  const a0 = T.waerme, a1 = T.was5;
  if (t < a0 || t > a1 + .4) return;
  const fadeOut = 1 - prog(t, a1, a1 + .4);
  const slow = ease(t, T.bremst, .6);
  const list = [[300, 440, 300, 640], [480, 440, 480, 640], [40, 760, 250, 760], [40, 980, 250, 980], [790, 900, 560, 900], [400, 1290, 400, 1080]];
  list.forEach(([x1, y1, x2, y2], i) => {
    const keep = i === 2 || i === 4; // nach dem Dämmen kommen nur noch zwei durch
    const alpha = (keep ? 1 : 1 - slow) * fadeOut * ease(t, a0 + i * .08, .3);
    if (alpha <= 0) return;
    const speed = lerp(.9, .3, slow);
    const k = ((t - a0) * speed + i * .17) % 1;
    const len = lerp(110, 70, slow);
    const sx = lerp(x1, x2, k), sy = lerp(y1, y2, k), ang = Math.atan2(y2 - y1, x2 - x1);
    arrow(sx - Math.cos(ang) * len, sy - Math.sin(ang) * len, sx, sy, { color: C.hot, width: 9, glow: C.hot, alpha: alpha * Math.sin(k * Math.PI) });
  });
}
function insideTemp(t) {
  if (t < T.kiste || t > T.glueck) return;
  let v = 4;
  v += 8 * ease(t, T.waerme, 2.6, E.lin);
  v += 6 * ease(t, T.daemm, 3.5, E.outCubic);
  v -= 14 * ease(t, T.saugt, 2.2, E.inOutCubic);
  const col = mixColor(C.cold, C.hot, (v - 4) / 14);
  const a = ease(t, T.kiste, .3) * (1 - prog(t, T.glueck - .3, T.glueck));
  txt(fmtT(v), 400, 935, { font: 'JetBrains Mono', size: 58, weight: 800, color: col, alpha: a });
  txt('INSIDE', 400, 885, { font: 'JetBrains Mono', size: 24, weight: 700, color: C.dim, alpha: a });
}

/* ---------- Kältekreislauf ---------- */
function pipe(p, frac, w = 22) {
  if (frac <= 0) return;
  strokePath(p, frac, '#8fb3e0', w);
  strokePath(p, frac, '#0b1a30', w - 9);
}
const build = t => ({
  evap: ease(t, T.rohr - .2, 1.0, E.inOutCubic),
  suct: ease(t, T.aber8 + .1, .9, E.inOutCubic),
  comp: ease(t, T.pumpe - .15, .35, E.outBack),
  cond: ease(t, T.gitter - .1, 1.1, E.inOutCubic),
  cap: ease(t, T.roehr - .1, .9, E.inOutCubic),
});
function flowPhase(t) {
  // langsam beim Aufbau, schnell sobald der Kreislauf geschlossen ist
  const fast = Math.max(0, t - T.vorn); const ramp = Math.min(fast, .6);
  return 45 * t + 130 * (fast - ramp / 2);
}
function particleColor(sec, f, t) {
  if (sec === 'evap') return mixColor(C.cold, C.vapor, clamp(f * 1.6));
  if (sec === 'suct' || sec === 'comp') return C.gas;
  if (sec === 'cond') return mixColor(C.hot, C.warm, clamp(f * 1.2));
  if (sec === 'cap') return f < .55 ? C.warm : C.cold;
  return '#fff';
}
function particles(t, b) {
  if (t < T.fluess) return;
  const vis = { evap: ease(t, T.fluess, .5), suct: b.suct, comp: b.comp >= 1 ? 1 : 0, cond: b.cond, cap: b.cap };
  const phase = flowPhase(t), step = 24;
  for (let u = (phase % step); u < U_TOTAL; u += step) {
    const s = SECTIONS.find(s => u >= s.u0 && u < s.u1); if (!s) continue;
    const f = (u - s.u0) / (s.u1 - s.u0);
    if (vis[s.k] <= 0 || f > vis[s.k]) continue;
    const [x, y] = pointAt(P[s.k], f * s.len);
    const col = particleColor(s.k, f, t);
    const r = s.k === 'cap' ? 4 : (s.k === 'suct' || s.k === 'comp') ? 5 : 6.5;
    ctx.save(); ctx.fillStyle = col; ctx.shadowColor = col; ctx.shadowBlur = 12;
    ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill(); ctx.restore();
  }
}
function compressor(t, k) {
  if (k <= 0) return;
  ctx.save(); ctx.translate(825, 1215); ctx.scale(k, k);
  const hot = ease(t, T.heiss, .5);
  ctx.fillStyle = '#20365a'; ctx.strokeStyle = mixColor('#d6e6ff', '#ff4a2e', hot); ctx.lineWidth = 6;
  if (hot > 0) { ctx.shadowColor = C.hot; ctx.shadowBlur = 40 * hot; }
  rr(-80, -65, 160, 130, 22); ctx.fill(); ctx.stroke(); ctx.shadowBlur = 0;
  const pump = t > T.zusammen ? Math.abs(Math.sin((t - T.zusammen) * (t > T.vorn ? 14 : 9))) : 0;
  ctx.fillStyle = '#8fb3e0'; rr(-45, -40 + pump * 40, 90, 22, 6); ctx.fill();
  line(0, -18 + pump * 40, 0, 50, '#8fb3e0', 10);
  ctx.restore();
}
function evapBubbles(t) {
  const a0 = T.verdampft, a1 = T.aber8;
  if (t < a0 || t > a1) return;
  const rnd = rand(9);
  for (let i = 0; i < 26; i++) {
    const bx = 240 + rnd() * 330, by = [640, 700, 760, 820][i % 4], ph = rnd();
    const k = ((t - a0) * .9 + ph) % 1;
    ctx.save(); ctx.globalAlpha = Math.sin(k * Math.PI) * (1 - prog(t, a1 - .4, a1));
    ctx.strokeStyle = C.vapor; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(bx + Math.sin(k * 9 + i) * 8, by - k * 50, 5 + k * 6, 0, 7); ctx.stroke(); ctx.restore();
  }
}
function foodHeat(t) {
  const a0 = T.saugt, a1 = T.aber8 + .3;
  if (t < a0 || t > a1) return;
  const fade = ease(t, a0, .3) * (1 - prog(t, a1 - .4, a1));
  [270, 530].forEach((x, i) => {
    const k = ((t - a0) * .8 + i * .3) % 1;
    const y = lerp(1000, 850, k);
    ctx.save(); ctx.globalAlpha = fade * Math.sin(k * Math.PI);
    arrow(x, y + 60, x, y, { color: C.warm, width: 9, glow: C.warm }); ctx.restore();
  });
}
/** Hitze, die der Verflüssiger an die Küche abgibt (wird zur Pointe hin stärker). */
function condenserHeat(t) {
  if (t < T.hitze) return;
  const boost = 1 + .8 * ease(t, T.schaufelt, 1) + .6 * ease(t, T.tuer, 1);
  const n = Math.round(5 * Math.min(boost, 1.6));
  for (let i = 0; i < n; i++) heatWave(930, 640 + i * (430 / n), 90 * boost, 0, t, i * .29, C.hot, ease(t, T.hitze, .4) * .95, .8 + .2 * boost);
}
function compHeat(t) {
  if (t < T.heiss) return;
  const a = ease(t, T.heiss, .4);
  txt(t < T.kueche9 ? fmtT(70, 0) : `${fmtT(70, 0)}  >  KITCHEN ${fmtT(21, 0)}`, 700, 1322, { font: 'JetBrains Mono', size: 30, weight: 800, color: C.hot, alpha: a * (1 - prog(t, T.kompressor + 1.5, T.kompressor + 2)) });
}
/** Begriffe springen groß rein und bleiben dann klein als Beschriftung stehen. */
function term(label, x, y, t, t0, sx, sy) {
  if (t < t0) return;
  const big = ease(t, t0, .35, E.outBack), settle = ease(t, t0 + 1.4, .5, E.inOutCubic);
  const size = lerp(46, 24, settle), px = lerp(x, sx, settle), py = lerp(y, sy, settle);
  ctx.save(); ctx.translate(px, py); ctx.scale(big, big);
  ctx.font = `900 ${size}px Inter`; ctx.letterSpacing = lerp(4, 2, settle) + 'px';
  const w = ctx.measureText(label).width + lerp(56, 26, settle), h = size + lerp(32, 16, settle);
  ctx.fillStyle = mixColor('#ffd23f', '#d6e6ff', settle); rr(-w / 2, -h / 2, w, h, 10); ctx.fill();
  ctx.fillStyle = '#071224'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(label, 2, 2);
  ctx.restore();
}

/* ---------- Einschub: Verdunsten (b5) ---------- */
function evapInset(t) {
  const a0 = T.was5 - .1, a1 = T.also6;
  if (t < a0 || t > a1 + .35) return;
  const k = ease(t, a0, .4, E.outBack) * (1 - ease(t, a1, .35, E.inCubic));
  ctx.save(); ctx.fillStyle = `rgba(4,10,22,${.75 * clamp(k)})`; ctx.fillRect(0, 380, W, 1000); ctx.restore();
  ctx.save(); ctx.translate(540, 880); ctx.scale(k, k);
  const cold = ease(t, T.friert, .8);
  ctx.fillStyle = mixColor('#123058', '#0f4a6e', cold); ctx.strokeStyle = C.line; ctx.lineWidth = 6;
  ctx.beginPath(); ctx.arc(0, 0, 330, 0, 7); ctx.fill(); ctx.stroke();
  ctx.save(); ctx.beginPath(); ctx.arc(0, 0, 327, 0, 7); ctx.clip();
  // Wasserlinie (Pool) unten
  ctx.fillStyle = '#1f6fb0'; ctx.fillRect(-340, 230, 680, 120);
  const [sx, sy] = between(t, T.friert, a1) ? shake(t, 6, 45) : [0, 0];
  stick(-40 + sx, 220 + sy, 1, { armL1: -.5, armL2: .6, armR1: .5, armR2: -.6, legL1: -.1, legR1: .1 }, { color: mixColor('#f4f4f4', '#bfe8ff', cold), face: cold > .5 ? 'strain' : 'calm', faceColor: '#0b1a30' });
  // Tropfen + Dampf, der Wärme (rote Punkte) mitnimmt
  const rnd = rand(4);
  for (let i = 0; i < 14; i++) {
    const bx = -110 + rnd() * 150, by = -60 + rnd() * 240, ph = rnd();
    const kk = ((t - a0) * .7 + ph) % 1;
    ctx.save(); ctx.globalAlpha = Math.sin(kk * Math.PI);
    ctx.strokeStyle = C.vapor; ctx.lineWidth = 4; ctx.beginPath();
    for (let j = 0; j < 8; j++) { const yy = by - kk * 220 - j * 10; const xx = bx + Math.sin(j * .9 + t * 5 + i) * 10; j ? ctx.lineTo(xx, yy) : ctx.moveTo(xx, yy); }
    ctx.stroke();
    ctx.fillStyle = C.hot; ctx.beginPath(); ctx.arc(bx + Math.sin(t * 5 + i) * 10, by - kk * 220 - 80, 6, 0, 7); ctx.fill();
    ctx.restore();
  }
  for (let i = 0; i < 5; i++) { // Tropfen am Körper
    ctx.fillStyle = '#7fd4ff'; ctx.beginPath(); const dx = -70 + i * 30, dy = -20 + (i % 3) * 50; ctx.arc(dx, dy, 7, 0, 7); ctx.fill();
  }
  if (t > T.friert) for (let i = 0; i < 4; i++) { // Frost-Glitzer
    const a = i * 1.6 + t; txt('✱', 120 + Math.cos(a) * 30, -120 + i * 60, { size: 40, color: C.cold, alpha: .6 + .4 * Math.sin(t * 6 + i) });
  }
  ctx.restore();
  txt('EVAPORATION = COOLING', 0, 375, { font: 'Inter', weight: 900, size: 44, color: C.cold, alpha: ease(t, T.verdunst, .3), spacing: 3 });
  ctx.restore();
}

/* ---------- Pointe ---------- */
function shell(t) {
  const k = ease(t, T.glueck - .1, 1.1, E.inOutCubic);
  if (k <= 0) return;
  const p = path([[140, 470], [960, 470], [960, 1300], [140, 1300], [140, 470]]);
  strokePath(p, k, C.white, 6, { glow: C.white, glowBlur: 18, alpha: 1 - .6 * ease(t, T.aber14, .5) });
  const c = ease(t, T.gebaut - .1, .35, E.outBack);
  if (c > 0 && t < T.aber14 + .3) {
    ctx.save(); ctx.translate(540, 1000); ctx.scale(c, c); ctx.globalAlpha = 1 - prog(t, T.aber14, T.aber14 + .3);
    ctx.fillStyle = C.ok; ctx.beginPath(); ctx.arc(0, 0, 110, 0, 7); ctx.fill();
    ctx.strokeStyle = '#071224'; ctx.lineWidth = 26; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath(); ctx.moveTo(-50, 5); ctx.lineTo(-12, 45); ctx.lineTo(55, -40); ctx.stroke(); ctx.restore();
  }
}
function noCold(t) {
  if (t < T.kaelte || t > T.schaufelt + .3) return;
  const k = ease(t, T.kaelte, .3, E.outBack), a = 1 - prog(t, T.schaufelt, T.schaufelt + .3);
  ctx.save(); ctx.translate(400, 920); ctx.scale(k, k); ctx.globalAlpha = a;
  ctx.strokeStyle = C.cold; ctx.lineWidth = 12; ctx.lineCap = 'round';
  for (let i = 0; i < 3; i++) { const an = i * Math.PI / 3; line(-Math.cos(an) * 80, -Math.sin(an) * 80, Math.cos(an) * 80, Math.sin(an) * 80, C.cold, 12); }
  line(-110, 110, 110, -110, C.hot, 18); ctx.restore();
}
function heatTransfer(t) {
  if (t < T.schaufelt || t > T.offene + .3) return;
  const a = 1 - prog(t, T.offene, T.offene + .3);
  const k1 = ease(t, T.schaufelt, .9, E.inOutCubic);
  const p1 = path([[330, 930], [450, 860], [600, 860], [700, 900], [780, 940]]);
  strokePath(p1, k1, C.warm, 26, { glow: C.warm, alpha: a });
  if (k1 >= 1) arrow(760, 925, 830, 960, { color: C.warm, width: 26, head: 70, glow: C.warm, alpha: a });
  txt('HEAT FROM INSIDE', 470, 800, { font: 'Inter', weight: 900, size: 34, color: C.warm, alpha: a * ease(t, T.schaufelt + .3, .3), spacing: 2 });
  const k2 = ease(t, T.motor, .6, E.outBack);
  if (k2 > 0) {
    arrow(825, 1150, 825, 1060 - 30 * k2, { color: C.hot, width: 22, head: 60, glow: C.hot, alpha: a * clamp(k2) });
    txt('+ MOTOR', 640, 1215, { font: 'Inter', weight: 900, size: 36, color: C.hot, alpha: a * clamp(k2), spacing: 2 });
  }
}
function coldSpill(t) {
  if (t < T.tuer) return;
  const rnd = rand(11);
  for (let i = 0; i < 9; i++) {
    const ph = rnd(), yy = 760 + rnd() * 340;
    const k = ((t - T.tuer) * .7 + ph) % 1;
    ctx.save(); ctx.globalAlpha = Math.sin(k * Math.PI) * .8 * ease(t, T.tuer, .4);
    ctx.strokeStyle = C.cold; ctx.lineWidth = 6; ctx.lineCap = 'round'; ctx.beginPath();
    for (let j = 0; j < 10; j++) { const x = 190 - k * 150 - j * 9; const y = yy + k * 120 + Math.sin(j * .8 + t * 4 + i) * 8; j ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
    ctx.stroke(); ctx.restore();
  }
}
function kitchenReadout(t) {
  if (t < T.kueche15 - .2) return;
  const k = ease(t, T.kueche15 - .2, .35, E.outBack);
  const v = 21 + .6 * ease(t, T.kueche15, 2.2, E.inOutCubic);
  const red = ease(t, T.heizt, .2);
  const [sx, sy] = between(t, T.heizt, T.heizt + .35) ? shake(t, 10, 60) : [0, 0];
  ctx.save(); ctx.translate(540 + sx, 425 + sy); ctx.scale(k, k);
  ctx.fillStyle = mixColor('#0b1a30', '#4a0f08', red); ctx.strokeStyle = mixColor('#ffa53c', '#ff4a2e', red); ctx.lineWidth = 5;
  rr(-270, -42, 540, 84, 42); ctx.fill(); ctx.stroke();
  txt('KITCHEN', -150, 2, { font: 'JetBrains Mono', size: 34, weight: 800, color: C.dim });
  txt(fmtT(v), 60, 2, { font: 'JetBrains Mono', size: 46, weight: 800, color: mixColor('#ffa53c', '#ff4a2e', red) });
  arrow(205, 22, 205, -22, { color: C.hot, width: 8, head: 26 });
  ctx.restore();
}
function finalFlash(t) {
  const a = (1 - prog(t, T.heizt, T.heizt + .5)) * (t >= T.heizt ? .35 : 0);
  if (a > 0) { ctx.fillStyle = `rgba(255,74,46,${a})`; ctx.fillRect(0, 0, W, H); }
  const k = ease(t, be('b16', .35), .4);
  if (k > 0) txt('FOLLOW FOR MORE EVERYDAY PHYSICS', W / 2, 1585, { font: 'Inter', weight: 800, size: 30, color: C.dim, alpha: k, spacing: 3 });
}

/* ---------- Frame ---------- */
function draw(ctx, t) {
  background(t);
  header(t);
  hookFridge(t);
  const b = build(t);
  const stageA = 1 - .82 * ease(t, T.was5 - .1, .3) * (1 - ease(t, T.also6, .3));
  ctx.save(); ctx.globalAlpha = stageA;
  leakArrows(t);
  food(t);
  box(t);
  pipe(P.evap, b.evap); pipe(P.suct, b.suct);
  if (b.comp > 0) pipe(P.comp, 1, 22);
  pipe(P.cond, b.cond, 20);
  if (b.cap > 0) { strokePath(P.cap, b.cap, '#8fb3e0', 10); strokePath(P.cap, b.cap, '#0b1a30', 4); }
  particles(t, b);
  compressor(t, b.comp);
  evapBubbles(t); foodHeat(t); insideTemp(t);
  condenserHeat(t); compHeat(t); coldSpill(t);
  if (t > T.gas8 && t < T.pumpe) txt('?', 700, 1300, { font: 'Anton', size: 120 * ease(t, T.gas8, .3, E.outBack), color: C.gas, stroke: 10, strokeColor: '#071224' });
  term('EVAPORATOR', 405, 600, t, T.verdampfer - .05, 405, 600);
  term('COMPRESSOR', 825, 1330, t, T.kompressor - .05, 825, 1312);
  term('CONDENSER', 830, 560, t, T.verfl - .05, 830, 560);
  term('CAPILLARY TUBE', 690, 450, t, T.tube - .05, 690, 500);
  shell(t); noCold(t); heatTransfer(t);
  ctx.restore();
  evapInset(t);
  pills(t);
  kitchenReadout(t);
  captions(t, {
    y: 1470, size: 132,
    accentWords: ['fridge', 'hotter', 'wrong', 'heat', 'hot', 'compressor', 'condenser', 'motor', 'warm', 'dumps'],
    accent: '#ff6a3d',
    accents: [{ words: ['cold', 'cool', 'evaporat', 'shiver', 'boils', 'freezing', 'ice', 'insulate', 'pressure', 'liquid'], color: C.cold }],
  });
  finalFlash(t);
}
/* ---------- Sound ---------- */
function cues() {
  cue(0, 'riser', .25); cue(T.falsch, 'glitch', .6); cue(T.bau, 'whoosh', .7);
  cue(T.essen, 'pop', .5); cue(T.essen + .12, 'pop', .45); cue(T.essen + .24, 'pop', .45); cue(T.kiste - .2, 'whoosh', .35);
  PILLS().forEach(([t0, l]) => cue(t0, l === 'PROBLEM' ? 'fail' : 'pop', l === 'PROBLEM' ? .35 : .5));
  cue(T.daemm, 'whoosh', .35); cue(T.was5 - .1, 'whoosh', .6); cue(T.friert, 'heartbeat', .25);
  cue(T.also6, 'whoosh', .5); cue(T.verdampft + .45, 'sizzle', .25);
  cue(T.verdampfer, 'ding', .5); cue(T.pumpe, 'pop', .6);
  for (let k = 0; k < 6; k++) cue(T.zusammen + k * .35, 'pump', .35);
  cue(T.heiss + .3, 'sizzle', .35); cue(T.kompressor, 'ding', .5); cue(T.hitze, 'sizzle', .35); cue(T.verfl, 'ding', .5);
  cue(T.druck, 'whoosh', .4); cue(T.eiskalt, 'glitch', .25); cue(T.tube, 'pop', .4);
  cue(T.vorn, 'riser', .45); cue(T.glueck, 'ding', .7); cue(T.gebaut, 'pop', .6);
  cue(T.kaelte, 'fail', .4); cue(T.schaufelt, 'whoosh', .5); cue(T.motor, 'pump', .5);
  cue(T.tuer, 'whoosh', .5); cue(T.kueche15, 'tick', .5); cue(T.heizt, 'impact', .9);
}
