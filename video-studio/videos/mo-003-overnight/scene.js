/* Motivation #003 – "The overnight success that took 7 years" (EN, Kokoro am_fenrir)
 * Stil: Spotlight-Kit (monochrom, leuchtende Figuren, Lichtkegel, Filmkorn, Pill-Labels, keine Wort-Untertitel).
 * Aufbau wie die Referenz: Ergebnis zuerst (Zähler rast hoch) -> Rückspulen -> "Imagine someone" -> Prinzip -> Maxime -> Titelkarte.
 */
const CAPTIONS = false; // true = dezente Wort-Untertitel einblenden
const VIEWS = 31400000, SHOWS = 364;
const HX = 540; // Bühnenmitte

const T = {
  successful: wt('h1', 'successful'), stop: wt('h1', 'stop'), invisible: wt('h1', 'invisible'), over2: wt('h1', 'overnight', 1),
  three: wt('b1', 'Three'), phones: wt('b1', 'phones'),
  next: wt('b2', 'next'), after: wt('b2', 'after'),
  nobody3: wt('b3', 'nobody'), name3: wt('b3', 'name'),
  promo: wt('b4', 'promotions'), apart: wt('b4', 'apartments'), weekends: wt('b4', 'weekends'),
  family: wt('b5', 'family'), asks: wt('b5', 'asks'),
  year5: wt('b6', 'year'), n250: wt('b6', '250', 0, 'end'), almost: wt('b6', 'almost'),
  seven: wt('b7', 'seven'), clip: wt('b7', 'clip'), ordinary: wt('b7', 'ordinary'), posted: wt('b7', 'posted'), online: wt('b7', 'online'),
  morning: wt('b8', 'morning'), millions: wt('b8', 'millions'), name8: wt('b8', 'name', 0, 'end'),
  headline: wt('b9', 'headline'), luck9: wt('b9', 'luck'),
  stage: wt('b10', 'stage'), never: wt('b10', 'never'), left: wt('b10', 'left'),
  world: wt('b11', 'world'), finally: wt('b11', 'finally'), caught: wt('b11', 'caught'),
};

/* ---------- Bausteine ---------- */
function stagePlatform(x, w = 340, a = 1) {
  ctx.save(); ctx.globalAlpha *= a; ctx.strokeStyle = 'rgba(255,255,255,.8)'; ctx.lineWidth = 4; ctx.fillStyle = '#121214';
  rr(x - w / 2, SP.floor, w, 46, 4); ctx.fill(); ctx.stroke(); ctx.restore();
}
function micStand(x, floorY = SP.floor) {
  line(x, floorY, x, floorY - 175, 'rgba(255,255,255,.75)', 5);
  line(x - 28, floorY, x + 28, floorY, 'rgba(255,255,255,.75)', 5);
  ctx.save(); ctx.fillStyle = '#f1f1f1'; ctx.beginPath(); ctx.ellipse(x - 10, floorY - 182, 14, 9, -.5, 0, 7); ctx.fill(); ctx.restore();
}
function roundTable(x, floorY = SP.floor) {
  line(x - 70, floorY - 82, x + 70, floorY - 82, '#f1f1f1', 6);
  line(x, floorY - 82, x, floorY, 'rgba(255,255,255,.6)', 5);
}
function confetti(t, t0, a = 1, reverse = 0) {
  const r = rand(21);
  ctx.save(); ctx.globalAlpha *= a; ctx.fillStyle = '#f1f1f1';
  for (let i = 0; i < 90; i++) {
    const x0 = r() * W, sp = 260 + r() * 260, ph = r() * 1600, rot = r() * 6;
    const tt = (t - t0) - reverse * 2 * Math.max(0, t - T.invisible);
    const y = ((tt * sp + ph) % 1700) - 100;
    ctx.save(); ctx.translate(x0 + Math.sin(tt * 2 + i) * 30, y); ctx.rotate(rot + tt * 3); ctx.fillRect(-6, -3, 12, 6); ctx.restore();
  }
  ctx.restore();
}
function tiles(n, total, cols, x0, y0, t, appearT, o = {}) {
  const sz = o.size ?? 24, gap = o.gap ?? 33;
  for (let i = 0; i < total; i++) {
    const c = i % cols, r = Math.floor(i / cols);
    const x = x0 + c * gap, y = y0 + r * gap;
    const on = i < n;
    const flash = on && appearT ? clamp(1 - (t - appearT(i)) / .5) : 0;
    const a = on ? (o.lit ?? .35) + .65 * flash : (o.ghost ?? 0);
    if (a <= 0) continue;
    ctx.save(); ctx.globalAlpha *= a; ctx.strokeStyle = '#f1f1f1'; ctx.lineWidth = 2.5;
    if (flash > 0) { ctx.shadowColor = '#fff'; ctx.shadowBlur = 18 * flash; }
    rr(x - sz / 2, y - sz / 2, sz, sz, 5); ctx.stroke();
    ctx.fillStyle = '#f1f1f1'; ctx.beginPath(); ctx.arc(x, y, 3.5, 0, 7); ctx.fill(); ctx.restore();
  }
}
function phoneIcon(x, y, w, h, a = 1, glow = 0) {
  ctx.save(); ctx.globalAlpha *= a; ctx.strokeStyle = '#f1f1f1'; ctx.lineWidth = Math.max(2.5, w / 30);
  if (glow) { ctx.shadowColor = '#fff'; ctx.shadowBlur = 24 * glow; }
  rr(x - w / 2, y - h / 2, w, h, w * .14); ctx.stroke(); ctx.shadowBlur = 0;
  ctx.fillStyle = '#f1f1f1'; ctx.beginPath(); ctx.moveTo(x - w * .1, y - h * .08); ctx.lineTo(x + w * .14, y); ctx.lineTo(x - w * .1, y + h * .08); ctx.closePath(); ctx.fill();
  ctx.restore();
}
const strum = t => Math.sin(t * 9);
const counterY = 470;

/* ---------- Szenen ---------- */
function sHook(t) {
  const fadeCrowd = 1 - ease(t, T.invisible, .7, E.inCubic);
  spotlight(HX, SP.floor, { strength: .2, wBot: 560 });
  spotlight(240, SP.floor + 100, { tilt: 260 + Math.sin(t * 1.3) * 120, strength: .1 * fadeCrowd, wBot: 420 });
  spotlight(840, SP.floor + 100, { tilt: -260 + Math.sin(t * 1.1 + 2) * 120, strength: .1 * fadeCrowd, wBot: 420 });
  stagePlatform(HX);
  pawn(HX, SP.floor, { guitar: true, guitarStrum: strum(t), armL: Math.PI * .85 + Math.sin(t * 5) * .1 });
  crowd(30, 330, 1440, t, { n: 5, cheer: true, alpha: fadeCrowd, seed: 3, depth: 30 });
  crowd(750, 1050, 1440, t, { n: 5, cheer: true, alpha: fadeCrowd, seed: 8, depth: 30 });
  confetti(t, -1, .8 * fadeCrowd, 1);
  // Zähler rast hoch, beim Zurückspulen wieder runter
  const up = E.outCubic(prog(t + .35, 0, 2.6));
  const down = E.inOutCubic(prog(t, T.invisible, be('h1') + .2));
  spCounter('VIEWS', fmtInt(lerp(VIEWS * up, 0, down)), HX, counterY);
  pill('OVERNIGHT SUCCESS', HX, 640, t, T.successful - .05, T.invisible);
  rewindLabel('7 YEARS EARLIER', HX, 560, ease(t, T.over2, .3));
  // Rückspul-Störung
  if (between(t, T.invisible, be('h1') + .3)) {
    const r = rand(Math.floor(t * 30));
    ctx.save(); ctx.fillStyle = 'rgba(255,255,255,.08)';
    for (let i = 0; i < 6; i++) ctx.fillRect(0, r() * H, W, 4 + r() * 18);
    ctx.restore();
  }
}
function audienceAt(t) { return t < T.next ? [0, 1, 2] : t < T.after ? [0, 2] : [1]; }
function sOpenMic(t) {
  spotlight(330, SP.floor, { strength: .17, wBot: 470 });
  micStand(410);
  pawn(330, SP.floor, { guitar: true, guitarStrum: strum(t) });
  roundTable(720); roundTable(920);
  const seats = [660, 780, 920], vis = audienceAt(t);
  const usingPhone = t > T.phones - .1 && t < bs('b2');
  seats.forEach((x, i) => {
    if (!vis.includes(i)) return;
    const ph = usingPhone && i !== 1;
    pawn(x, SP.floor - 10, { s: .72, color: '#6f6f75', glow: 6, armR: ph ? 2.5 : null, phone: ph ? 1 : 0 });
  });
  // Tisch vorne drüber (verdeckt Unterkörper)
  ctx.save(); ctx.fillStyle = SP.bg; ctx.fillRect(600, SP.floor - 80, 420, 76); ctx.restore();
  roundTable(720); roundTable(920);
  // Flackern beim Wochenwechsel
  for (const tw of [T.next, T.after]) { const d = t - tw; if (d > 0 && d < .25) { ctx.fillStyle = `rgba(0,0,0,${.7 * (1 - d / .25)})`; ctx.fillRect(0, 0, W, H); } }
  rewindLabel('7 YEARS EARLIER', HX, 560, 1 - ease(t, T.three - .3, .4));
  if (t < bs('b2')) spCounter('AUDIENCE', '3', HX, counterY, { alpha: ease(t, T.three, .3) });
  else spCounter('SHOWS PLAYED', t < T.next ? '1' : t < T.after ? '2' : '3', HX, counterY);
  pill('ON THEIR PHONES', 790, 980, t, T.phones - .05, bs('b2') + .3);
  pill('WEEK 2', HX, 640, t, T.next, T.after - .2, { style: 'outline' });
  pill('WEEK 3', HX, 640, t, T.after, be('b2'), { style: 'outline' });
}
function sName(t) {
  spotlight(HX, SP.floor, { strength: .12, wBot: 460 });
  pawn(HX, SP.floor, { guitar: true, guitarStrum: strum(t) });
  // Passanten laufen vorbei, ohne hinzusehen
  for (let i = 0; i < 4; i++) { const x = ((t - bs('b3')) * 230 + i * 330) % 1500 - 200; pawn(x, SP.floor + 90, { s: .7, color: '#55555b', glow: 0, alpha: .7 }); }
  spCounter('YEAR', '2', HX, counterY);
  const k = ease(t, T.name3, .5);
  pill('HIS NAME', HX, 990, t, T.nobody3, T.name3 + .1);
  pill('· · ·', HX, 990, t, T.name3 + .2, 1e9, { style: 'outline' });
}
function sFriends(t) {
  spotlight(210, SP.floor, { strength: .06, wBot: 360 });
  pawn(210, SP.floor, { s: .85, guitar: true, guitarStrum: strum(t) * .3, alpha: .85 });
  // Treppe
  const st = [[420, 580, 1240], [580, 740, 1160], [740, 900, 1080]];
  ctx.save(); ctx.strokeStyle = 'rgba(255,255,255,.55)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(420, SP.floor);
  for (const [a, b, y] of st) { ctx.lineTo(a, y); ctx.lineTo(b, y); } ctx.lineTo(900, SP.floor); ctx.stroke(); ctx.restore();
  const marks = [T.promo, T.apart, T.weekends], labels = ['PROMOTION', 'NEW APARTMENT', 'WEEKENDS OFF'];
  st.forEach(([a, b, y], i) => {
    const x = (a + b) / 2, on = ease(t, marks[i] - .1, .4);
    spotlight(x, y, { strength: .14 * on, wBot: 260, wTop: 40 });
    pawn(x, y - 10 * on, { s: .82, alpha: .55 + .45 * on, armL: on ? Math.PI * .8 : null });
  });
  st.forEach(([a, b, y], i) => pill(labels[i], (a + b) / 2, y - 235, t, marks[i] - .05, 1e9, { size: 22 }));
}
function sDinner(t) {
  lamp(HX, 840, SP.floor);
  const fam = [300, 430, 650, 780];
  fam.forEach((x, i) => pawn(x, SP.floor, { s: .82, color: '#d9d9de', glow: 14, armR: i === 2 && t > T.asks ? 2.2 : null }));
  pawn(930, SP.floor, { s: .82, alpha: .9 });
  ctx.save(); ctx.fillStyle = SP.bg; ctx.fillRect(180, 1205, 740, 95); ctx.restore();
  line(180, 1205, 900, 1205, '#f1f1f1', 7);
  line(230, 1205, 230, SP.floor, 'rgba(255,255,255,.6)', 5); line(850, 1205, 850, SP.floor, 'rgba(255,255,255,.6)', 5);
  pill('FAMILY DINNER', HX, 640, t, T.family - .1, T.asks - .2, { style: 'outline' });
  pill('SO… WHEN ARE YOU GETTING A REAL JOB?', HX, 960, t, T.asks - .05, 1e9, { size: 24 });
}
function sGrid(t) {
  const a0 = T.year5 - .1, a1 = T.n250 + .2;
  const n = Math.round(lerp(3, 250, E.inOutCubic(prog(t, a0, a1))));
  const tOf = i => lerp(a0, a1, clamp((i - 3) / 247)); // ungefähr, für das Aufblitzen
  tiles(n, 264, 22, 177, 700, t, tOf);
  spotlight(HX, SP.floor, { strength: .08, wBot: 360 });
  pawn(HX, SP.floor, { s: .8, guitar: true, guitarStrum: strum(t) });
  spCounter('SHOWS PLAYED', String(n), HX, counterY);
  rewindLabel('', -999, 0, 0);
  txt('YEAR 5', HX, 560, { font: 'Inter', weight: 800, size: 26, color: SP.dim, spacing: 5, alpha: ease(t, T.year5, .3) });
  pill('FOR ALMOST NOBODY', HX, 640, t, T.almost - .05, 1e9);
}
function sClip(t) {
  const toPhone = ease(t, T.posted - .2, .6, E.inOutCubic);
  ctx.save(); ctx.globalAlpha *= 1 - toPhone;
  spotlight(400, SP.floor, { strength: .17, wBot: 470 });
  micStand(480); pawn(400, SP.floor, { guitar: true, guitarStrum: strum(t) });
  const rec = t > T.clip - .1;
  pawn(760, SP.floor, { s: .72, color: '#6f6f75', glow: 6 });
  pawn(880, SP.floor, { s: .72, color: '#8a8a90', glow: 8, armR: rec ? 2.55 : null, phone: rec ? 1 : 0 });
  if (rec) pill('REC', 905, 1000, t, T.clip, 1e9, { size: 20, style: 'outline' });
  ctx.restore();
  if (toPhone > 0) { // großer Handy-Rahmen mit der kleinen Bühne darin
    ctx.save(); ctx.globalAlpha *= toPhone;
    const s = lerp(.6, 1, toPhone);
    ctx.translate(HX, 960); ctx.scale(s, s); ctx.translate(-HX, -960);
    ctx.strokeStyle = '#f1f1f1'; ctx.lineWidth = 6; ctx.shadowColor = '#fff'; ctx.shadowBlur = 30; rr(HX - 170, 650, 340, 620, 40); ctx.stroke(); ctx.shadowBlur = 0;
    ctx.save(); ctx.beginPath(); ctx.rect(HX - 160, 660, 320, 600); ctx.clip();
    spotlight(HX, 1150, { strength: .2, wBot: 260, top: 660, wTop: 40 }); pawn(HX, 1150, { s: .55, guitar: true, guitarStrum: strum(t) });
    ctx.restore();
    const up = ease(t, T.online - .1, .4, E.outBack);
    if (up > 0) { arrow(HX, 1360, HX, 1300 - 40 * up, { color: '#f1f1f1', width: 10, head: 30, alpha: up }); }
    ctx.restore();
    pill('POSTED', HX, 600, t, T.online - .05, 1e9);
  }
  if (t < T.posted) spCounter('YEAR', '7', HX, counterY, { alpha: ease(t, T.seven - .2, .3) });
  pill('ONE ORDINARY NIGHT', HX, 640, t, T.ordinary - .05, T.posted - .2, { style: 'outline' });
}
function sViral(t) {
  const a0 = T.millions - .15;
  const cols = 7, rows = 9, cx = 3, cy = 4;
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const d = Math.hypot(c - cx, (r - cy) * .8);
    const k = ease(t, a0 + d * .12, .35, E.outBack);
    if (k <= 0) continue;
    phoneIcon(198 + c * 114, 660 + r * 86, 58 * k, 74 * k, .35 + .65 * clamp(1 - (t - a0 - d * .12) / .8), clamp(1 - (t - a0 - d * .12) / .6));
  }
  pill('THE NEXT MORNING', HX, 560, t, T.morning - .1, 1e9, { style: 'outline' });
  spCounter('VIEWS', fmtInt(VIEWS * E.inOutCubic(prog(t, a0, T.name8 + .3))), HX, 440);
}
function sHeadlines(t) {
  spotlight(HX, SP.floor, { strength: .07, wBot: 700 });
  const heads = ['OVERNIGHT SENSATION', 'OUT OF NOWHERE', 'WHAT A LUCKY BREAK'];
  heads.forEach((h, i) => {
    const t0 = bs('b9') + .05 + i * .42, k = ease(t, t0, .4, E.outCubic);
    if (k <= 0) return;
    const side = i % 2 ? 1 : -1, y = 760 + i * 210;
    ctx.save(); ctx.translate(HX + side * (1 - k) * 700, y); ctx.rotate(side * -.04);
    ctx.fillStyle = '#ececee'; ctx.shadowColor = 'rgba(255,255,255,.4)'; ctx.shadowBlur = 24; rr(-330, -80, 660, 160, 10); ctx.fill(); ctx.shadowBlur = 0;
    txt('THE DAILY NEWS', 0, -48, { font: 'Inter', weight: 800, size: 18, color: '#555', spacing: 4 });
    txt(h, 0, 0, { font: 'Inter', weight: 900, size: 46, color: '#111', spacing: 1 });
    for (let l = 0; l < 2; l++) line(-280, 42 + l * 16, 280 - l * 120, 42 + l * 16, 'rgba(0,0,0,.25)', 6);
    if (i === 2 && t > T.luck9) { const u = ease(t, T.luck9, .3); line(-20, 30, -20 + 230 * u, 30, '#111', 7); }
    ctx.restore();
  });
}
function sNeverLeft(t) {
  const a0 = T.stage - .2, a1 = T.never + .25;
  const n = Math.round(lerp(250, SHOWS, E.inOutCubic(prog(t, a0, a1))));
  tiles(n, 374, 22, 177, 620, t, i => lerp(a0, a1, clamp((i - 250) / 114)), { lit: .28, ghost: 0 });
  spotlight(HX, SP.floor, { strength: .22, wBot: 520 });
  stagePlatform(HX);
  pawn(HX, SP.floor, { guitar: true, guitarStrum: strum(t) });
  spCounter('SHOWS PLAYED', String(n), HX, counterY - 20, { alpha: 1 });
  pill('7 YEARS · 364 SHOWS', HX, 1440, t, T.left - .1, 1e9);
}
function sFinale(t) {
  const a0 = T.world - .1;
  spotlight(HX, SP.floor, { strength: .22, wBot: 560 });
  spotlight(240, SP.floor + 100, { tilt: 260 + Math.sin(t * 1.3) * 120, strength: .1 * ease(t, T.finally - .4, .6), wBot: 420 });
  spotlight(840, SP.floor + 100, { tilt: -260 + Math.sin(t * 1.1 + 2) * 120, strength: .1 * ease(t, T.finally - .4, .6), wBot: 420 });
  stagePlatform(HX);
  pawn(HX, SP.floor, { guitar: true, guitarStrum: strum(t), armL: t > T.finally ? Math.PI * .85 : null });
  const walk = E.outCubic(prog(t, a0, T.finally));
  ctx.save(); ctx.translate(-420 * (1 - walk), 0); crowd(30, 330, 1440, t, { n: 5, cheer: t > T.finally - .2, seed: 3, depth: 30 }); ctx.restore();
  ctx.save(); ctx.translate(420 * (1 - walk), 0); crowd(750, 1050, 1440, t, { n: 5, cheer: t > T.finally - .2, seed: 8, depth: 30 }); ctx.restore();
  spCounter('VIEWS', fmtInt(VIEWS), HX, counterY, { alpha: ease(t, a0, .5) });
}
function sTitle(t) {
  spotlight(HX, SP.floor, { strength: .16, wBot: 420 });
  pawn(HX, SP.floor, { s: .7, guitar: true, guitarStrum: strum(t) * .4 });
  txt('7 YEARS  ·  364 SHOWS  ·  1 NIGHT', HX, 820, { font: 'Inter', weight: 800, size: 26, color: SP.dim, spacing: 4, alpha: ease(t, T.caught + .3, .6) });
  titleCard('STAY ON STAGE', HX, 920, t, T.caught + .1, { size: 90 });
}

const SCENES = [
  [0, bs('b1'), sHook], [bs('b1'), bs('b3'), sOpenMic], [bs('b3'), bs('b4'), sName], [bs('b4'), bs('b5'), sFriends],
  [bs('b5'), bs('b6'), sDinner], [bs('b6'), bs('b7'), sGrid], [bs('b7'), bs('b8'), sClip], [bs('b8'), bs('b9'), sViral],
  [bs('b9'), bs('b10'), sHeadlines], [bs('b10'), bs('b11'), sNeverLeft], [bs('b11'), T.caught, sFinale], [T.caught, TL.duration + 1, sTitle],
];

const ZOOM = 1.22; // Hochformat: Bühne größer ziehen als im 16:9-Vorbild
function draw(ctx, t) {
  spBackground();
  ctx.save(); ctx.translate(540, 1120); ctx.scale(ZOOM, ZOOM); ctx.translate(-540, -1120);
  runScenes(t, SCENES);
  spFloor(SP.floor, .6);
  ctx.restore();
  spFinish(t);
  if (CAPTIONS) captions(t, { y: 1480, size: 70, font: 'Inter', weight: 800, stroke: 0, accentWords: [] });
}

/* ---------- Sound (dezent, Musik kommt in der App dazu) ---------- */
function cues() {
  cue(0, 'riser', .25);
  for (let x = 0; x < 2.2; x += .09) cue(x, 'tick', .12);
  cue(T.invisible + .25, 'whoosh', .5); cue(T.invisible + .3, 'glitch', .3);
  SCENES.slice(2).forEach(([a]) => cue(a - .1, 'whoosh', .16));
  cue(T.three + .3, 'pop', .3); cue(T.phones + .45, 'pop', .3);
  cue(T.next - .05, 'tick', .4); cue(T.after - .05, 'tick', .4);
  [T.promo, T.apart, T.weekends].forEach(x => cue(x + .3, 'pop', .3));
  cue(T.asks + .5, 'pop', .3);
  for (let x = T.year5; x < T.n250 + .2; x += .08) cue(x, 'tick', .14);
  cue(T.clip + .3, 'tick', .4); cue(T.posted + .4, 'whoosh', .35);
  cue(T.morning - .4, 'riser', .35); cue(T.millions + .45, 'impact', .55);
  for (let x = T.millions; x < T.name8; x += .1) cue(x, 'tick', .1);
  [0, 1, 2].forEach(i => cue(bs('b9') + .05 + i * .42, 'whoosh', .25));
  cue(T.left + .35, 'ding', .35);
  cue(T.world, 'riser', .3); cue(be('b11') + .05, 'impact', .55); cue(be('b11') + .15, 'ding', .4);
}
