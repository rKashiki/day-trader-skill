/* Kit "Spotlight" – monochromer, filmischer Look (inspiriert von Erklär-Essays wie cryothum):
 * leuchtende Figuren, Lichtkegel von oben, Filmkorn, Vignette, kleine Pill-Labels, große Zähler.
 * Wird nach engine/lib.js geladen. Alle Funktionen sind deterministisch (gleiches t = gleiches Bild).
 */
const SP = { bg: '#0b0b0c', fig: '#f1f1f1', dim: '#8d8d93', crowd: '#7a7a80', line: 'rgba(255,255,255,0.35)', floor: 1300 };

/* ---------- Hintergrund, Korn, Vignette ---------- */
const _grain = (() => {
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const g = c.getContext('2d'), img = g.createImageData(256, 256), r = rand(77);
  for (let i = 0; i < img.data.length; i += 4) { const v = r() * 255; img.data[i] = img.data[i + 1] = img.data[i + 2] = v; img.data[i + 3] = 255; }
  g.putImageData(img, 0, 0); return c;
})();
function spBackground() {
  ctx.fillStyle = SP.bg; ctx.fillRect(0, 0, W, H);
}
function spFinish(t, o = {}) {
  // Vignette + Filmkorn (wechselt pro Frame) + leichtes Flackern
  const v = ctx.createRadialGradient(W / 2, H * .5, 250, W / 2, H * .5, 1150);
  v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, `rgba(0,0,0,${o.vignette ?? .75})`);
  ctx.fillStyle = v; ctx.fillRect(0, 0, W, H);
  const f = Math.floor(t * 24);
  ctx.save(); ctx.globalAlpha = o.grain ?? .07; ctx.globalCompositeOperation = 'overlay';
  const ox = (f * 97) % 256, oy = (f * 61) % 256;
  for (let x = -ox; x < W; x += 256) for (let y = -oy; y < H; y += 256) ctx.drawImage(_grain, x, y);
  ctx.restore();
}
function spFloor(y = SP.floor, alpha = 1) {
  ctx.save(); ctx.globalAlpha *= alpha; ctx.strokeStyle = SP.line; ctx.lineWidth = 3; ctx.setLineDash([14, 12]);
  ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); ctx.restore();
}
/** Volumetrischer Lichtkegel von oben auf (x, floorY). */
function spotlight(x, floorY = SP.floor, o = {}) {
  const a = o.alpha ?? 1, top = o.top ?? -50, wTop = o.wTop ?? 70, wBot = o.wBot ?? 520, tilt = o.tilt ?? 0;
  if (a <= 0) return;
  ctx.save(); ctx.globalAlpha *= a;
  const g = ctx.createLinearGradient(0, top, 0, floorY);
  g.addColorStop(0, `rgba(255,255,255,${o.strength ?? .16})`); g.addColorStop(1, 'rgba(255,255,255,0.025)');
  ctx.fillStyle = g; ctx.beginPath();
  ctx.moveTo(x + tilt - wTop / 2, top); ctx.lineTo(x + tilt + wTop / 2, top);
  ctx.lineTo(x + wBot / 2, floorY); ctx.lineTo(x - wBot / 2, floorY); ctx.closePath(); ctx.fill();
  const e = ctx.createRadialGradient(x, floorY, 5, x, floorY, wBot * .55);
  e.addColorStop(0, `rgba(255,255,255,${(o.strength ?? .16) * 1.4})`); e.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = e; ctx.beginPath(); ctx.ellipse(x, floorY, wBot * .55, 34, 0, 0, 7); ctx.fill();
  ctx.restore();
}
/** Hängelampe mit Lichtkegel (z. B. über einem Esstisch). */
function lamp(x, y, floorY, alpha = 1) {
  ctx.save(); ctx.globalAlpha *= alpha;
  line(x, 0, x, y - 26, 'rgba(255,255,255,.6)', 3);
  ctx.fillStyle = '#e9e9e9'; ctx.beginPath(); ctx.moveTo(x - 22, y - 28); ctx.lineTo(x + 22, y - 28); ctx.lineTo(x + 58, y); ctx.lineTo(x - 58, y); ctx.closePath(); ctx.fill();
  ctx.restore();
  spotlight(x, floorY, { top: y, wTop: 116, wBot: 760, alpha, strength: .13 });
}

/* ---------- Figuren ---------- */
/** Leuchtende "Spielfigur" (Kopf + glockenförmiger Körper). Füße auf (x, floorY).
 *  o: { s, color, glow, alpha, armL, armR (Winkel in Rad, 0 = nach unten, PI = nach oben), lean, guitar, phone, seated } */
function pawn(x, floorY, o = {}) {
  const s = o.s ?? 1, col = o.color ?? SP.fig, a = o.alpha ?? 1;
  if (a <= 0) return null;
  ctx.save(); ctx.translate(x, floorY); ctx.scale(s, s); ctx.rotate(o.lean ?? 0); ctx.globalAlpha *= a;
  ctx.shadowColor = o.glowColor ?? 'rgba(255,255,255,0.55)'; ctx.shadowBlur = o.glow ?? 28;
  ctx.fillStyle = col; ctx.strokeStyle = col; ctx.lineCap = 'round';
  // Körper
  ctx.beginPath(); ctx.moveTo(-60, 0); ctx.bezierCurveTo(-62, -88, -42, -150, 0, -150); ctx.bezierCurveTo(42, -150, 62, -88, 60, 0); ctx.closePath(); ctx.fill();
  // Kopf
  ctx.beginPath(); ctx.arc(0, -186, 31, 0, 7); ctx.fill();
  // Arme
  const arm = (side, ang) => {
    if (ang === undefined || ang === null) return null;
    const sx = side * 34, sy = -118, L = 92;
    const hx = sx + Math.sin(ang) * L * side, hy = sy + Math.cos(ang) * L;
    ctx.lineWidth = 24; ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(hx, hy); ctx.stroke();
    return [hx, hy];
  };
  const hl = arm(-1, o.armL), hr = arm(1, o.armR);
  ctx.shadowBlur = 0;
  if (o.guitar) guitar(o.guitarStrum ?? 0);
  if (o.phone && hr) phoneIn(hr[0], hr[1], o.phone);
  ctx.restore();
  return { head: [x, floorY - 186 * s], hand: hr ? [x + hr[0] * s, floorY + hr[1] * s] : null };
}
function guitar(strum) {
  ctx.save(); ctx.translate(10, -52); ctx.rotate(-1.0);
  ctx.fillStyle = '#1b1b1d'; ctx.strokeStyle = '#f1f1f1'; ctx.lineWidth = 5;
  ctx.beginPath(); ctx.ellipse(0, 20, 38, 31, 0, 0, 7); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.ellipse(0, -20, 29, 24, 0, 0, 7); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#1b1b1d'; ctx.beginPath(); ctx.ellipse(0, 0, 30, 24, 0, 0, 7); ctx.fill();
  ctx.strokeStyle = '#f1f1f1'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(0, 2, 10, 0, 7); ctx.stroke();
  ctx.fillStyle = '#f1f1f1'; ctx.fillRect(-5, -150, 10, 110); rr(-11, -172, 22, 26, 4); ctx.fill();
  ctx.restore();
  // Schlaghand
  ctx.save(); ctx.strokeStyle = '#f1f1f1'; ctx.lineWidth = 22; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(34, -118); ctx.lineTo(40, -60 + strum * 10); ctx.stroke(); ctx.restore();
}
function phoneIn(hx, hy, bright = 1) {
  ctx.save(); ctx.translate(hx, hy - 20);
  ctx.shadowColor = '#ffffff'; ctx.shadowBlur = 30 * bright;
  ctx.fillStyle = '#ffffff'; rr(-13, -24, 26, 46, 5); ctx.fill(); ctx.restore();
}
/** Publikum: Reihe grauer Figuren, optional mit erhobenen Armen (jubelnd). */
function crowd(x0, x1, floorY, t, o = {}) {
  const n = o.n ?? 6, r = rand(o.seed ?? 5);
  for (let i = 0; i < n; i++) {
    const x = lerp(x0, x1, n === 1 ? .5 : i / (n - 1)) + (r() - .5) * 20, ph = r() * 6, s = (o.s ?? .78) * (.9 + r() * .2);
    const up = o.cheer ? Math.PI * .82 + Math.sin(t * 7 + ph) * .12 : null;
    pawn(x, floorY + (o.depth ? r() * o.depth : 0), { s, color: o.color ?? SP.crowd, glow: 10, alpha: o.alpha ?? 1, armL: up, armR: o.cheer ? Math.PI * .82 + Math.sin(t * 7 + ph + 1) * .12 : null });
  }
}

/* ---------- Texte ---------- */
/** Kleines Pill-Label (weiß, schwarzer Text). style: 'solid' | 'outline' */
function pill(s, x, y, t, t0, t1 = 1e9, o = {}) {
  if (t < t0 || t > t1 + .3) return;
  const k = ease(t, t0, .3, E.outBack) * (1 - prog(t, t1, t1 + .3));
  ctx.save(); ctx.translate(x, y); ctx.scale(k, k); ctx.globalAlpha *= clamp(k * 1.5);
  ctx.font = `800 ${o.size ?? 26}px Inter`; ctx.letterSpacing = (o.spacing ?? 3) + 'px';
  const w = ctx.measureText(s).width + 44, h = (o.size ?? 26) + 26;
  if (o.style === 'outline') { ctx.strokeStyle = '#f1f1f1'; ctx.lineWidth = 3; rr(-w / 2, -h / 2, w, h, h / 2); ctx.stroke(); }
  else { ctx.shadowColor = 'rgba(255,255,255,.5)'; ctx.shadowBlur = 20; ctx.fillStyle = '#f1f1f1'; rr(-w / 2, -h / 2, w, h, h / 2); ctx.fill(); ctx.shadowBlur = 0; }
  ctx.fillStyle = o.style === 'outline' ? '#f1f1f1' : '#111'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(s, 2, 2);
  ctx.restore();
}
/** Zähler: kleines Label über großer Zahl. */
function spCounter(label, value, x, y, o = {}) {
  const a = o.alpha ?? 1; if (a <= 0) return;
  const sc = o.scale ?? 1;
  ctx.save(); ctx.translate(x, y); ctx.scale(sc, sc); ctx.globalAlpha *= a;
  txt(label, 0, -62, { font: 'Inter', weight: 800, size: 24, color: SP.dim, spacing: 5 });
  ctx.shadowColor = 'rgba(255,255,255,.45)'; ctx.shadowBlur = 24;
  txt(value, 0, 0, { font: 'Inter', weight: 900, size: o.size ?? 96, color: '#ffffff', spacing: 1 });
  ctx.restore();
}
const fmtInt = n => Math.round(n).toLocaleString('en-US');
/** "<< N YEARS EARLIER" mit gezeichnetem Rückspul-Symbol. */
function rewindLabel(s, x, y, a = 1) {
  if (a <= 0) return;
  ctx.save(); ctx.globalAlpha *= a; ctx.font = '800 26px Inter'; ctx.letterSpacing = '5px';
  const w = ctx.measureText(s).width; const x0 = x - (w + 54) / 2;
  ctx.fillStyle = '#f1f1f1';
  for (const dx of [0, 20]) { ctx.beginPath(); ctx.moveTo(x0 + dx + 20, y - 12); ctx.lineTo(x0 + dx, y); ctx.lineTo(x0 + dx + 20, y + 12); ctx.closePath(); ctx.fill(); }
  ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillText(s, x0 + 54, y + 2); ctx.restore();
}
/** Großer Schlusstitel. */
function titleCard(s, x, y, t, t0, o = {}) {
  const k = ease(t, t0, .8, E.outCubic); if (k <= 0) return;
  ctx.save(); ctx.globalAlpha *= k; ctx.shadowColor = 'rgba(255,255,255,.6)'; ctx.shadowBlur = 40 * k;
  txt(s, x, y + (1 - k) * 20, { font: 'Inter', weight: 900, size: o.size ?? 96, color: '#ffffff', spacing: o.spacing ?? 6 });
  ctx.restore();
}

/* ---------- Szenen-Steuerung ---------- */
/** Blendet Szenen weich über Schwarz ineinander. scenes: [[start, end, fn(t, local, k)], ...] */
function runScenes(t, scenes, fade = .28) {
  for (const [a, b, fn] of scenes) {
    if (t < a - fade || t > b + fade) continue;
    const k = clamp(Math.min((t - (a - fade)) / (2 * fade), ((b + fade) - t) / (2 * fade)));
    if (k <= 0) continue;
    ctx.save(); ctx.globalAlpha = k;
    // langsamer Kamera-Push pro Szene
    const z = 1 + .035 * prog(t, a, b);
    ctx.translate(W / 2, H / 2); ctx.scale(z, z); ctx.translate(-W / 2, -H / 2);
    fn(t, t - a, k);
    ctx.restore();
  }
}
