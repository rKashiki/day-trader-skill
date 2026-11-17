/* Kit "HUD" – minimalistischer Linien-Look (inspiriert von Finanz-Erklärvideos wie nolledge):
 * schwarzer Grund, dünne weiße Linien-Icons in Ringen mit rotierender Skala, kleine Großbuchstaben-Labels,
 * Münzen auf gepunkteten Pfaden, schlichte Diagramme. Wird nach engine/lib.js geladen.
 */
const HUD = { fg: '#f2f2f2', dim: '#8e8e94', faint: 'rgba(255,255,255,0.18)', lw: 3.2 };

const _hgrain = (() => {
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const g = c.getContext('2d'), img = g.createImageData(256, 256), r = rand(31);
  for (let i = 0; i < img.data.length; i += 4) { const v = r() * 255; img.data[i] = img.data[i + 1] = img.data[i + 2] = v; img.data[i + 3] = 255; }
  g.putImageData(img, 0, 0); return c;
})();
function hudBackground() {
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
  const g = ctx.createRadialGradient(W / 2, H * .47, 50, W / 2, H * .47, 900);
  g.addColorStop(0, 'rgba(255,255,255,0.045)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
}
function hudFinish(t) {
  const f = Math.floor(t * 24);
  ctx.save(); ctx.globalAlpha = .05; ctx.globalCompositeOperation = 'screen';
  const ox = (f * 89) % 256, oy = (f * 53) % 256;
  for (let x = -ox; x < W; x += 256) for (let y = -oy; y < H; y += 256) ctx.drawImage(_hgrain, x, y);
  ctx.restore();
}
function hudLabel(s, x, y, a = 1, o = {}) {
  if (a <= 0) return;
  txt(s, x, y, { font: 'Inter', weight: o.weight ?? 700, size: o.size ?? 24, color: o.color ?? HUD.dim, spacing: o.spacing ?? 6, alpha: a, align: o.align ?? 'center' });
}
/** Ring mit Skala. k = Einblend-Fortschritt 0..1 (zeichnet sich kreisförmig auf). */
function ring(x, y, r, t, k, o = {}) {
  if (k <= 0) return;
  const a = o.alpha ?? 1, dir = o.dir ?? 1;
  ctx.save(); ctx.translate(x, y); ctx.globalAlpha *= a;
  if (o.glow) { ctx.shadowColor = '#fff'; ctx.shadowBlur = 22 * o.glow; }
  ctx.strokeStyle = HUD.fg; ctx.lineWidth = HUD.lw;
  ctx.beginPath(); ctx.arc(0, 0, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * clamp(k)); ctx.stroke();
  ctx.shadowBlur = 0;
  // Skala außen, dreht sich langsam
  const n = o.ticks ?? 60, rot = t * .12 * dir;
  ctx.strokeStyle = 'rgba(255,255,255,0.45)'; ctx.lineWidth = 2;
  for (let i = 0; i < n * clamp(k); i++) {
    const an = rot + i / n * Math.PI * 2, len = i % 5 === 0 ? 12 : 6;
    ctx.beginPath(); ctx.moveTo(Math.cos(an) * (r + 12), Math.sin(an) * (r + 12)); ctx.lineTo(Math.cos(an) * (r + 12 + len), Math.sin(an) * (r + 12 + len)); ctx.stroke();
  }
  // Fortschrittsbogen
  if (o.progress) {
    ctx.strokeStyle = HUD.fg; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.arc(0, 0, r + 34, -Math.PI / 2 + rot, -Math.PI / 2 + rot + Math.PI * 2 * o.progress); ctx.stroke();
  }
  ctx.restore();
  if (o.icon) icon(o.icon, x, y, r * .55, a * clamp(k * 1.6 - .4), o.iconText);
  if (o.label) hudLabel(o.label, x, y + r + 58, a * clamp(k * 2 - 1));
}
/** Linien-Icons. size = halbe Kantenlänge. */
function icon(name, x, y, s, a = 1, extra) {
  if (a <= 0) return;
  ctx.save(); ctx.translate(x, y); ctx.globalAlpha *= a; ctx.strokeStyle = HUD.fg; ctx.fillStyle = HUD.fg;
  ctx.lineWidth = HUD.lw; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  const u = s / 30;
  ctx.scale(u, u); ctx.lineWidth = HUD.lw / u;
  ctx.beginPath();
  switch (name) {
    case 'person':
      ctx.arc(0, -10, 10, 0, 7); ctx.moveTo(-20, 22); ctx.bezierCurveTo(-20, 4, 20, 4, 20, 22); break;
    case 'dollar':
      ctx.font = '700 40px Inter'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('$', 0, 2); break;
    case 'car':
      ctx.moveTo(-28, 10); ctx.lineTo(-28, -2); ctx.lineTo(-18, -4); ctx.lineTo(-10, -14); ctx.lineTo(12, -14); ctx.lineTo(20, -4); ctx.lineTo(28, -2); ctx.lineTo(28, 10); ctx.closePath();
      ctx.moveTo(-8, 10); ctx.arc(-14, 12, 6, 0, 7); ctx.moveTo(20, 12); ctx.arc(14, 12, 6, 0, 7); break;
    case 'phone':
      ctx.roundRect(-13, -24, 26, 48, 5); ctx.moveTo(-3, 17); ctx.lineTo(3, 17); break;
    case 'chart':
      ctx.moveTo(-24, 22); ctx.lineTo(24, 22); ctx.moveTo(-22, 14); ctx.lineTo(-8, 2); ctx.lineTo(2, 8); ctx.lineTo(22, -18);
      ctx.moveTo(12, -18); ctx.lineTo(22, -18); ctx.lineTo(22, -8); break;
    case 'bag':
      ctx.roundRect(-18, -8, 36, 30, 4); ctx.moveTo(-8, -8); ctx.bezierCurveTo(-8, -24, 8, -24, 8, -8); break;
    case 'briefcase':
      ctx.roundRect(-24, -10, 48, 32, 4); ctx.moveTo(-8, -10); ctx.lineTo(-8, -18); ctx.lineTo(8, -18); ctx.lineTo(8, -10); ctx.moveTo(-24, 2); ctx.lineTo(24, 2); break;
    case 'question':
      ctx.font = '800 46px Inter'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('?', 0, 3); break;
    case 'text':
      ctx.font = '800 30px Inter'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(extra ?? '', 0, 2); break;
  }
  ctx.stroke();
  ctx.restore();
}
/** Gepunktete Linie entlang eines Pfades (bis Anteil frac). */
function dotted(p, frac, a = 1, gap = 16) {
  if (frac <= 0 || a <= 0) return;
  ctx.save(); ctx.globalAlpha *= a; ctx.fillStyle = 'rgba(255,255,255,0.6)';
  for (let d = 0; d <= p.total * clamp(frac); d += gap) { const [x, y] = pointAt(p, d); ctx.beginPath(); ctx.arc(x, y, 2.4, 0, 7); ctx.fill(); }
  ctx.restore();
}
/** Münzen, die regelmäßig von Anfang zu Ende eines Pfades wandern. */
function coins(p, t, t0, t1, o = {}) {
  if (t < t0 || t > t1 + (o.travel ?? 1)) return;
  const every = o.every ?? .35, travel = o.travel ?? 1;
  for (let s = t0; s <= Math.min(t, t1); s += every) {
    const k = (t - s) / travel; if (k < 0 || k > 1) continue;
    const [x, y] = pointAt(p, p.total * E.inOutCubic(k));
    ctx.save(); ctx.globalAlpha *= Math.sin(k * Math.PI) * .9 + .1;
    ctx.strokeStyle = HUD.fg; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(x, y, 13, 0, 7); ctx.stroke();
    ctx.fillStyle = HUD.fg; ctx.font = '700 15px Inter'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('$', x, y + 1);
    ctx.restore();
  }
}
/** Strahlenkranz (Hook-Effekt). */
function burst(x, y, t, t0, o = {}) {
  const k = prog(t, t0, t0 + (o.dur ?? 1.4)); if (k >= 1) return;
  const r = rand(o.seed ?? 3), n = o.n ?? 90;
  ctx.save(); ctx.globalAlpha *= 1 - k; ctx.strokeStyle = HUD.fg; ctx.lineWidth = 2;
  for (let i = 0; i < n; i++) {
    const an = r() * Math.PI * 2, r0 = (o.r ?? 110) + r() * 40 + E.outCubic(k) * 260, len = 10 + r() * 50;
    ctx.beginPath(); ctx.moveTo(x + Math.cos(an) * r0, y + Math.sin(an) * r0); ctx.lineTo(x + Math.cos(an) * (r0 + len), y + Math.sin(an) * (r0 + len)); ctx.stroke();
  }
  ctx.restore();
}
/** Große Zahl mit kleinem Label darunter. */
function hudNumber(value, label, x, y, a = 1, o = {}) {
  if (a <= 0) return;
  ctx.save(); ctx.globalAlpha *= a; ctx.shadowColor = 'rgba(255,255,255,.35)'; ctx.shadowBlur = 18;
  txt(value, x, y, { font: 'Inter', weight: 800, size: o.size ?? 76, color: HUD.fg, align: o.align ?? 'center' });
  ctx.restore();
  hudLabel(label, x + (o.align === 'left' ? 4 : 0), y + (o.size ?? 76) * .72, a, { size: 22, align: o.align });
}
