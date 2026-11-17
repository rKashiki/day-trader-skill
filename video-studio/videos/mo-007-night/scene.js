/* Motivation – "The morning is decided the night before" (wortlos, Musik kommt in der App dazu)
 * Zwei Figuren, ein Zimmer, eine Nacht im Zeitraffer. Links: scrollen bis 2 Uhr, morgens Snooze und Panik.
 * Rechts: Handy weg, Licht aus, um 6 Uhr wach und ruhig. Text-Pointe am Ende.
 */
const M = id => bs(id);
const FLOOR = 1240, LX = 300, RX = 780;      // Bettmitten
const BED_Y = 1150;                           // Matratzenoberkante
const MIN = 60;

/* ---------- Uhrzeit (Minuten ab Mitternacht Tag 1) ---------- */
const CLOCK = [[0, 23 * MIN], [M('late'), 23 * MIN + 5], [M('twoAm'), 26 * MIN], [M('sixAm'), 30 * MIN], [M('snoozeEnd'), 30 * MIN + 100], [M('panic'), 31 * MIN + 45], [99, 31 * MIN + 50]];
function minutes(t) { for (let i = 1; i < CLOCK.length; i++) if (t <= CLOCK[i][0]) return lerp(CLOCK[i - 1][1], CLOCK[i][1], E.inOutCubic(prog(t, CLOCK[i - 1][0], CLOCK[i][0]))); return CLOCK[CLOCK.length - 1][1]; }
function timeLabel(m) {
  m = Math.floor(m) % 1440; const h = Math.floor(m / 60), mm = m % 60;
  return `${(h % 12) || 12}:${String(mm).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
}
function clockFace(x, y, m) {
  ctx.save(); ctx.translate(x, y); ctx.strokeStyle = '#d9dbe0'; ctx.lineWidth = 4;
  ctx.beginPath(); ctx.arc(0, 0, 58, 0, 7); ctx.stroke();
  for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; line(Math.sin(a) * 48, -Math.cos(a) * 48, Math.sin(a) * 54, -Math.cos(a) * 54, '#d9dbe0', 3); }
  const ah = (m / 720) * Math.PI * 2, am = (m / 60) * Math.PI * 2;
  line(0, 0, Math.sin(ah) * 28, -Math.cos(ah) * 28, '#ffffff', 6); line(0, 0, Math.sin(am) * 44, -Math.cos(am) * 44, '#ffffff', 4);
  ctx.restore();
}

/* ---------- Raum ---------- */
function lamp(x, on) {
  line(x, 0, x, 690, 'rgba(255,255,255,.25)', 2);
  if (on > 0) {
    const g = ctx.createRadialGradient(x, 700, 5, x, 700, 520);
    g.addColorStop(0, `rgba(255,214,150,${.45 * on})`); g.addColorStop(1, 'rgba(255,214,150,0)');
    ctx.fillStyle = g; ctx.fillRect(x - 520, 180, 1040, 1100);
    const c = ctx.createLinearGradient(0, 700, 0, FLOOR);
    c.addColorStop(0, `rgba(255,220,170,${.12 * on})`); c.addColorStop(1, `rgba(255,220,170,${.03 * on})`);
    ctx.fillStyle = c; ctx.beginPath(); ctx.moveTo(x - 30, 700); ctx.lineTo(x + 30, 700); ctx.lineTo(x + 260, FLOOR); ctx.lineTo(x - 260, FLOOR); ctx.closePath(); ctx.fill();
  }
  ctx.save(); ctx.fillStyle = on > .5 ? '#fff3dc' : '#5d6068'; if (on > .5) { ctx.shadowColor = '#ffd696'; ctx.shadowBlur = 30; }
  ctx.beginPath(); ctx.arc(x, 700, 13, 0, 7); ctx.fill(); ctx.restore();
}
function bed(x) {
  ctx.save(); ctx.strokeStyle = '#8c8f97'; ctx.lineWidth = 4; ctx.fillStyle = '#1c1d22';
  rr(x - 175, BED_Y, 350, 44, 6); ctx.fill(); ctx.stroke();
  line(x - 175, BED_Y + 44, x - 175, FLOOR, '#8c8f97', 4); line(x + 175, BED_Y + 44, x + 175, FLOOR, '#8c8f97', 4);
  line(x - 175, BED_Y + 44, x - 175, BED_Y - 70, '#8c8f97', 5); // Kopfteil
  ctx.fillStyle = '#d8dae0'; rr(x - 160, BED_Y - 26, 80, 26, 10); ctx.fill(); // Kissen
  ctx.restore();
}
function blanket(x, a) {
  if (a <= 0) return;
  ctx.save(); ctx.globalAlpha *= a; ctx.fillStyle = '#5e566e'; ctx.strokeStyle = '#7c7390'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(x - 70, BED_Y); ctx.bezierCurveTo(x - 60, BED_Y - 44, x + 140, BED_Y - 40, x + 168, BED_Y); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.restore();
}
function nightstand() {
  ctx.save(); ctx.strokeStyle = '#8c8f97'; ctx.lineWidth = 4; ctx.fillStyle = '#17181c';
  rr(500, 1150, 80, 90, 4); ctx.fill(); ctx.stroke(); ctx.restore();
}
function zzz(x, y, t, a = 1) {
  if (a <= 0) return;
  for (let i = 0; i < 3; i++) { const k = ((t * .6 + i / 3) % 1); txt('z', x + k * 40, y - k * 90, { font: 'Inter', weight: 800, size: 26 + k * 20, color: '#aeb2bc', alpha: a * Math.sin(k * Math.PI) }); }
}

/* ---------- Figuren ---------- */
function leftPerson(t) {
  const panic = M('panic');
  const lie = { ...poseLie(LX - 60, BED_Y - 4) };
  let p = lie, phone = t < M('twoAm') ? 1 : 0;
  if (t > panic) { // Panik: hochschrecken, aufspringen, losrennen
    const up = ease(t, panic, .35, E.outBack), run = prog(t, panic + .8, panic + 2.6);
    p = up < 1 ? lerpPose(lie, poseStand(LX - 120, BED_Y), up) : poseWalk(lerp(LX - 120, -120, run), FLOOR, t * 16);
    if (up >= 1 && run <= 0) p = poseStand(LX - 120, FLOOR);
  }
  if (t > panic && t < panic + .6) { const [sx, sy] = shake(t, 9, 70); p.hx += sx; p.hy += sy; }
  const h = stickman(p, { s: .62, color: '#e9ebf0', glow: 10 });
  blanket(LX, 1 - ease(t, panic, .3));
  if (phone && t > .4) { // Handy-Licht im Gesicht
    const [hx, hy] = h.head, fl = .8 + .2 * Math.sin(t * 23);
    const g = ctx.createRadialGradient(hx + 30, hy - 30, 4, hx + 30, hy - 30, 150);
    g.addColorStop(0, `rgba(170,205,255,${.5 * fl})`); g.addColorStop(1, 'rgba(170,205,255,0)');
    ctx.fillStyle = g; ctx.fillRect(hx - 140, hy - 180, 320, 320);
    ctx.save(); ctx.translate(hx + 36, hy - 40); ctx.rotate(.5); ctx.fillStyle = '#dfe9ff'; ctx.shadowColor = '#9ec2ff'; ctx.shadowBlur = 24; rr(-11, -18, 22, 36, 4); ctx.fill(); ctx.restore();
  }
  zzz(h.head[0], h.head[1] - 30, t, t > M('twoAm') + .3 && t < M('panic') ? 1 : 0);
  // Snooze-Arm
  return h;
}
function rightPerson(t) {
  const wake = M('sixAm') + .2;
  const lie = poseLie(RX - 60, BED_Y - 4);
  let p = lie;
  if (t > wake) {
    const sit = ease(t, wake, .6, E.inOutCubic), stand = ease(t, wake + .8, .6, E.inOutCubic);
    p = lerpPose(lerpPose(lie, poseSit(RX + 120, BED_Y + 26), sit), poseStand(RX + 60, FLOOR), stand);
    if (t > wake + 1.6) p = lerpPose(poseStand(RX + 60, FLOOR), poseCelebrate(RX + 60, FLOOR), .25 + .15 * Math.sin(t * 2));
  }
  const h = stickman(p, { s: .62, color: '#e9ebf0', glow: t > wake ? 24 : 10, glowColor: t > wake ? '#ffe2b0' : '#e9ebf0' });
  blanket(RX, 1 - ease(t, wake, .4));
  zzz(h.head[0], h.head[1] - 30, t, t > 1.6 && t < wake ? 1 : 0);
  return h;
}

/* ---------- Raum zeichnen (für Bild + Spiegelung) ---------- */
function room(t) {
  const lampL = 0, lampR = (1 - ease(t, 1.4, .3)) + ease(t, M('sixAm') + .3, .3);
  lamp(LX, lampL); lamp(RX, Math.min(1, lampR));
  bed(LX); bed(RX); nightstand();
  // Wecker auf dem Nachttisch
  const ring = between(t, M('sixAm'), M('sixAm') + .8) || between(t, M('panic') - .1, M('panic') + .5);
  const [sx] = ring ? shake(t, 4, 80) : [0];
  ctx.save(); ctx.translate(540 + sx, 1132); ctx.strokeStyle = '#d9dbe0'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(0, 0, 16, 0, 7); ctx.stroke(); ctx.restore();
  const hl = leftPerson(t), hr = rightPerson(t);
  return { hl, hr };
}

function draw(ctx, t) {
  // Wand + Morgendämmerung
  const dawn = ease(t, M('sixAm') - .5, 2.5);
  const g = ctx.createLinearGradient(0, 0, 0, FLOOR);
  g.addColorStop(0, mixColor('#0e0f12', '#1d212a', dawn)); g.addColorStop(1, mixColor('#141518', '#232730', dawn));
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, FLOOR);
  ctx.fillStyle = '#0b0c0e'; ctx.fillRect(0, FLOOR, W, H - FLOOR);
  ctx.save(); ctx.translate(540, 1150); ctx.scale(1.2, 1.2); ctx.translate(-540, -1150); // Hochformat: Zimmer größer
  ctx.fillStyle = '#0b0c0e'; ctx.fillRect(-200, FLOOR, W + 400, 900);
  const { hl, hr } = room(t);
  // Spiegelung im glänzenden Boden
  ctx.save(); ctx.globalAlpha = .16; ctx.translate(0, FLOOR * 2); ctx.scale(1, -1); room(t); ctx.restore();
  const fade = ctx.createLinearGradient(0, FLOOR, 0, FLOOR + 380);
  fade.addColorStop(0, 'rgba(11,12,14,0)'); fade.addColorStop(1, 'rgba(11,12,14,1)');
  ctx.fillStyle = fade; ctx.fillRect(0, FLOOR, W, 380);
  line(0, FLOOR, W, FLOOR, 'rgba(255,255,255,.18)', 2);
  // Uhr + Zeit
  const m = minutes(t);
  clockFace(540, 600, m);
  txt(timeLabel(m), 540, 698, { font: 'JetBrains Mono', weight: 800, size: 34, color: '#c9ccd3', spacing: 2 });
  // Kleine Etiketten
  chip('ONE MORE VIDEO', LX - 40, 900, t, .5, M('late') + .4, { color: '#c9ccd2', size: 24 });
  chip('PHONE AWAY', RX, 900, t, .8, M('late') + .4, { color: '#c9ccd2', size: 24 });
  chip('STILL SCROLLING', LX - 20, 900, t, M('late') + 1.4, M('twoAm') - .1, { color: '#9ec2ff', size: 24 });
  ['SNOOZE', 'SNOOZE ×2', 'SNOOZE ×3'].forEach((s, i) => chip(s, LX - 20, 900 - i * 0, t, M('sixAm') + .5 + i * 1.15, M('sixAm') + 1.5 + i * 1.15, { color: '#ff8a7a', size: 24 }));
  ['✓ WATER', '✓ WORKOUT', '✓ PLAN FOR THE DAY'].forEach((s, i) => chip(s, RX - 10, 820 + i * 66, t, M('sixAm') + 1.6 + i * .9, 1e9, { color: '#ffd38a', size: 22 }));
  ['LATE!', 'NO BREAKFAST', 'STRESSED'].forEach((s, i) => chip(s, 250 + i * 40, 820 + i * 66, t, M('panic') + .5 + i * .35, 1e9, { color: GL.red, size: 22 }));
  ctx.restore();
  // Pointe
  const l1 = ease(t, M('text1'), .6), l2 = ease(t, M('text2'), .6);
  txt('THE MORNING IS DECIDED', 540, 290 + (1 - l1) * 10, { font: 'JetBrains Mono', weight: 800, size: 46, color: '#ffffff', spacing: 5, alpha: l1 });
  txt('THE NIGHT BEFORE.', 540, 362 + (1 - l2) * 10, { font: 'JetBrains Mono', weight: 800, size: 46, color: '#ffd38a', spacing: 5, alpha: l2, glow: '#ffd38a', glowBlur: 20 });
  glowFinish(t);
}

function cues() {
  cue(.1, 'tick', .3); cue(1.4, 'pop', .25);
  for (let x = M('late'); x < M('sixAm'); x += .25) cue(x, 'tick', .1);
  cue(M('sixAm'), 'heartbeat', .2); for (let i = 0; i < 6; i++) cue(M('sixAm') + i * .12, 'tick', .45);
  for (let i = 0; i < 3; i++) { cue(M('sixAm') + .5 + i * 1.15, 'fail', .2); cue(M('sixAm') + 1.6 + i * .9, 'pop', .3); }
  for (let i = 0; i < 6; i++) cue(M('panic') - .1 + i * .1, 'tick', .5);
  cue(M('panic') + .1, 'impact', .5); for (let i = 0; i < 3; i++) cue(M('panic') + .5 + i * .35, 'fail', .2);
  cue(M('text1'), 'whoosh', .3); cue(M('text2') + .1, 'ding', .4);
}
