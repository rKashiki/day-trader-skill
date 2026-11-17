/* Kit "Glow" – leuchtende Strichfiguren in einer nächtlichen Berglandschaft
 * (inspiriert von Motivations-Parabeln wie psychoologie). Wird nach engine/lib.js geladen.
 * Posen sind Objekte mit Winkeln (0 = gerade nach unten, positiv = nach vorne/rechts) und lassen sich mit lerpPose mischen.
 */
const GL = { hero: '#f4f6fa', crowd: '#70757d', mock: '#b06a64', red: '#ff5a52', gold: '#ffc861', ground: 1250 };
const LEN = { torso: 112, thigh: 68, shin: 68, ua: 52, fa: 50, head: 22 };

/* ---------- Hintergrund ---------- */
const _ridges = (() => {
  const r = rand(12), layers = [];
  for (let l = 0; l < 3; l++) {
    const pts = [], base = 900 + l * 120, amp = 160 - l * 40;
    for (let x = -100; x <= W + 100; x += 60) pts.push([x, base - Math.abs(Math.sin(x / (180 + l * 70) + l * 2)) * amp - r() * 40]);
    layers.push(pts);
  }
  return layers;
})();
function glowBackground(t, o = {}) {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, o.top ?? '#1b1f27'); g.addColorStop(.6, o.mid ?? '#11141a'); g.addColorStop(1, '#090a0d');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  if (o.sun) { // warmes Licht hinter dem Gipfel
    const [sx, sy] = o.sunAt ?? [W / 2, 760];
    const s = ctx.createRadialGradient(sx, sy, 10, sx, sy, 700);
    s.addColorStop(0, `rgba(255,190,90,${.55 * o.sun})`); s.addColorStop(.35, `rgba(255,170,70,${.18 * o.sun})`); s.addColorStop(1, 'rgba(255,160,60,0)');
    ctx.fillStyle = s; ctx.fillRect(0, 0, W, H);
  }
  const shades = ['#232831', '#1b1f26', '#15181e'];
  _ridges.forEach((pts, l) => {
    ctx.save(); ctx.translate(-(o.pan ?? 0) * (.15 + l * .15), 0);
    ctx.fillStyle = shades[l]; ctx.beginPath(); ctx.moveTo(pts[0][0], H);
    pts.forEach(p => ctx.lineTo(...p)); ctx.lineTo(pts[pts.length - 1][0], H); ctx.closePath(); ctx.fill(); ctx.restore();
  });
  // Nebelband
  const f = ctx.createLinearGradient(0, 950, 0, 1250);
  f.addColorStop(0, 'rgba(160,170,190,0)'); f.addColorStop(.6, 'rgba(160,170,190,0.06)'); f.addColorStop(1, 'rgba(160,170,190,0)');
  ctx.fillStyle = f; ctx.fillRect(0, 900, W, 400);
}
/** Gelände als gefüllte Silhouette mit heller Kante. pts von links nach rechts. */
function terrain(pts, o = {}) {
  ctx.save(); ctx.globalAlpha *= o.alpha ?? 1;
  ctx.fillStyle = o.fill ?? '#101318'; ctx.beginPath(); ctx.moveTo(pts[0][0], H + 50);
  pts.forEach(p => ctx.lineTo(...p)); ctx.lineTo(pts[pts.length - 1][0], H + 50); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = o.edge ?? 'rgba(170,180,200,0.35)'; ctx.lineWidth = 3; ctx.beginPath(); pts.forEach((p, i) => i ? ctx.lineTo(...p) : ctx.moveTo(...p)); ctx.stroke();
  ctx.restore();
}
function glowFinish(t) {
  const v = ctx.createRadialGradient(W / 2, H * .5, 300, W / 2, H * .5, 1150);
  v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,.6)'); ctx.fillStyle = v; ctx.fillRect(0, 0, W, H);
}
function moon(x, y, a = 1) {
  if (a <= 0) return;
  ctx.save(); ctx.globalAlpha *= a; ctx.fillStyle = '#e9ecf2'; ctx.shadowColor = '#fff'; ctx.shadowBlur = 40;
  ctx.beginPath(); ctx.arc(x, y, 46, 0, 7); ctx.fill(); ctx.shadowBlur = 0;
  ctx.globalCompositeOperation = 'destination-out'; ctx.beginPath(); ctx.arc(x + 22, y - 12, 40, 0, 7); ctx.fill(); ctx.restore();
}
function coneLight(x, floorY, a = 1, w = 420) {
  if (a <= 0) return;
  ctx.save(); ctx.globalAlpha *= a;
  const g = ctx.createLinearGradient(0, 0, 0, floorY); g.addColorStop(0, 'rgba(255,255,255,0.13)'); g.addColorStop(1, 'rgba(255,255,255,0.03)');
  ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(x - 50, 0); ctx.lineTo(x + 50, 0); ctx.lineTo(x + w / 2, floorY); ctx.lineTo(x - w / 2, floorY); ctx.closePath(); ctx.fill();
  ctx.restore();
}

/* ---------- Posen ---------- */
// p = { hx, hy (Hüfte), lean, la:[o,u], ra:[o,u], ll:[o,u], rl:[o,u], rot }
function poseStand(x, y) { return { hx: x, hy: y - 135, lean: 0, la: [-.14, -.06], ra: [.14, .06], ll: [-.09, -.04], rl: [.09, .04], rot: 0 }; }
function poseWalk(x, y, ph) {
  const s = Math.sin(ph);
  return { hx: x, hy: y - 132 - 3 * Math.abs(s), lean: .06, la: [-.38 * s, -.38 * s - .25], ra: [.38 * s, .38 * s - .25], ll: [.42 * s, .42 * s - .35 * Math.max(0, -Math.cos(ph))], rl: [-.42 * s, -.42 * s - .35 * Math.max(0, Math.cos(ph))], rot: 0 };
}
function poseClimb(x, y, ph) {
  const s = Math.sin(ph);
  return { hx: x, hy: y, lean: .18, la: [Math.PI - .5 - .3 * s, Math.PI - .25], ra: [Math.PI - .25 + .3 * s, Math.PI - .15], ll: [.75 + .35 * s, -.15], rl: [.75 - .35 * s, -.15], rot: 0 };
}
function poseKneel(x, y) { return { hx: x, hy: y - 70, lean: .38, la: [.25, .1], ra: [.75, .2], ll: [1.25, .78], rl: [-.25, -1.5], rot: 0 }; }
function poseCelebrate(x, y) { return { hx: x, hy: y - 135, lean: 0, la: [-(Math.PI - .5), -(Math.PI - .35)], ra: [Math.PI - .5, Math.PI - .35], ll: [-.12, -.05], rl: [.12, .05], rot: 0 }; }
function poseLaugh(x, y, ph) {
  const b = Math.sin(ph) * .08;
  return { hx: x, hy: y - 135, lean: -.16 + b, la: [-.55, .9], ra: [.55, -.9], ll: [-.1, -.04], rl: [.1, .04], rot: 0 };
}
function posePoint(x, y, dir = -1) { const p = poseStand(x, y); p.ra = [dir * 1.45, dir * 1.5]; p.lean = .04 * dir; return p; }
function poseLie(x, y) { return { hx: x, hy: y - 14, lean: 0, la: [.2, .1], ra: [-.2, -.1], ll: [.05, 0], rl: [-.05, 0], rot: -Math.PI / 2 }; }
function lerpPose(a, b, k) {
  const o = {};
  for (const key in a) o[key] = Array.isArray(a[key]) ? a[key].map((v, i) => lerp(v, b[key][i], k)) : lerp(a[key], b[key], k);
  return o;
}

/* ---------- Figur ---------- */
function stickman(p, o = {}) {
  const s = o.s ?? 1, col = o.color ?? GL.hero, a = o.alpha ?? 1;
  if (a <= 0) return;
  const seg = (x, y, ang, len) => [x + Math.sin(ang) * len, y + Math.cos(ang) * len];
  ctx.save(); ctx.translate(p.hx, p.hy); ctx.rotate(p.rot || 0); ctx.scale(s, s); ctx.globalAlpha *= a;
  const neck = [Math.sin(p.lean) * LEN.torso, -Math.cos(p.lean) * LEN.torso];
  const sh = [neck[0] - Math.sin(p.lean) * 10, neck[1] + Math.cos(p.lean) * 10];
  const head = [neck[0] + Math.sin(p.lean) * (LEN.head + 5), neck[1] - Math.cos(p.lean) * (LEN.head + 5)];
  const limbs = [];
  for (const [o1, o2] of [p.ll, p.rl]) { const k = seg(0, 0, o1, LEN.thigh); limbs.push([[0, 0], k, seg(...k, o2, LEN.shin)]); }
  limbs.push([[0, 0], neck]);
  for (const [o1, o2] of [p.la, p.ra]) { const e = seg(...sh, o1, LEN.ua); limbs.push([sh, e, seg(...e, o2, LEN.fa)]); }
  const strokeAll = () => {
    for (const l of limbs) { ctx.beginPath(); ctx.moveTo(...l[0]); l.slice(1).forEach(q => ctx.lineTo(...q)); ctx.stroke(); }
    ctx.beginPath(); ctx.arc(...head, LEN.head, 0, 7); ctx.fill();
  };
  ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = col; ctx.fillStyle = col;
  if (o.glow !== 0) { ctx.shadowColor = o.glowColor ?? col; ctx.shadowBlur = o.glow ?? 30; ctx.lineWidth = 9; strokeAll(); }
  ctx.shadowBlur = 0; ctx.lineWidth = 8; strokeAll();
  ctx.restore();
  // Weltkoordinaten von Händen/Kopf zurückgeben (z. B. für Werkzeuge)
  const cr = Math.cos(p.rot || 0), sr = Math.sin(p.rot || 0);
  const wp = q => [p.hx + (q[0] * cr - q[1] * sr) * s, p.hy + (q[0] * sr + q[1] * cr) * s];
  return { handL: wp(limbs[3][2]), handR: wp(limbs[4][2]), head: wp(head) };
}
function poseDig(x, y, ph) {
  const s = Math.sin(ph);
  return { hx: x, hy: y - 126, lean: .5 + .12 * s, la: [.75 + .4 * s, .35 + .3 * s], ra: [1.05 + .4 * s, .5 + .3 * s], ll: [-.12, -.05], rl: [.4, .05], rot: 0 };
}
function poseSit(x, y) { return { hx: x, hy: y - 30, lean: .42, la: [1.35, .45], ra: [1.55, .55], ll: [2.0, .2], rl: [1.8, .12], rot: 0 }; }

/* ---------- Texte ---------- */
function chip(s, x, y, t, t0, t1 = 1e9, o = {}) {
  if (t < t0 || t > t1 + .25) return;
  const k = ease(t, t0, .25, E.outBack) * (1 - prog(t, t1, t1 + .25));
  ctx.save(); ctx.translate(x, y); ctx.scale(k, k); ctx.globalAlpha *= clamp(k * 1.5);
  ctx.font = `800 ${o.size ?? 30}px Inter`; ctx.letterSpacing = '2px';
  const w = ctx.measureText(s).width + 40, h = (o.size ?? 30) + 26;
  ctx.fillStyle = o.bg ?? 'rgba(20,22,28,.85)'; ctx.strokeStyle = o.color ?? GL.red; ctx.lineWidth = 3;
  rr(-w / 2, -h / 2, w, h, 12); ctx.fill(); ctx.stroke();
  ctx.fillStyle = o.color ?? GL.red; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(s, 1, 2);
  ctx.restore();
}
function haPops(x0, x1, y, t, t0, t1, seed = 4) {
  const r = rand(seed);
  for (let i = 0; i < 14; i++) {
    const at = t0 + r() * (t1 - t0), x = lerp(x0, x1, r()), yy = y - r() * 120, sz = 34 + r() * 22;
    const d = t - at; if (d < 0 || d > 1.1) continue;
    txt('HA', x, yy - d * 40, { font: 'Inter', weight: 900, size: sz * E.outBack(clamp(d / .2)), color: GL.red, alpha: 1 - clamp((d - .6) / .5) });
  }
}
function redX(x, y, k, a = 1) {
  if (k <= 0 || a <= 0) return;
  ctx.save(); ctx.translate(x, y); ctx.scale(k, k); ctx.globalAlpha *= a; ctx.strokeStyle = GL.red; ctx.lineWidth = 12; ctx.lineCap = 'round';
  ctx.shadowColor = GL.red; ctx.shadowBlur = 16;
  ctx.beginPath(); ctx.moveTo(-34, -34); ctx.lineTo(34, 34); ctx.moveTo(34, -34); ctx.lineTo(-34, 34); ctx.stroke(); ctx.restore();
}
