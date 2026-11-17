/* Motivation #004 – "Same raise, different future" (EN, Kokoro am_fenrir)
 * Stil: HUD-Kit (schwarz, Linien-Icons in Ringen, Münzen auf Punktpfaden, keine Wort-Untertitel).
 * Zahlen: 300 $/Monat, 7 % durchschnittliche Jahresrendite, monatlich verzinst -> nach 30 Jahren 365.991 $ (108.000 $ eingezahlt).
 */
const CAPTIONS = false;
const MONTHLY = 300, RATE = .07;
const fv = years => { const r = RATE / 12, n = 12 * years; return n <= 0 ? 0 : MONTHLY * ((1 + r) ** n - 1) / r; };
const money = v => '$' + Math.round(v).toLocaleString('en-US');

const T = {
  coworkers: wt('h1', 'coworkers'), same: wt('h1', 'same'), n300: wt('h1', '300'), month: wt('h1', 'month'),
  upgrades: wt('b1', 'upgrades'), life1: wt('b1', 'life'), car: wt('b1', 'car'), phone: wt('b1', 'phone'),
  keeps: wt('b2', 'keeps'), same2: wt('b2', 'same'), invests: wt('b2', 'invests'),
  year1: wt('b3', 'year'), barely: wt('b3', 'barely'),
  ten: wt('b4', 'ten'), k50: wt('b4', 'thousand', 0, 'end'),
  thirty: wt('b5', 'thirty'), k360: wt('b5', 'thousand', 0, 'end'),
  put: wt('b6', 'put'), rest: wt('b6', 'rest'), growth: wt('b6', 'growth'),
  job: wt('b7', 'job'), raise7: wt('b7', 'raise'), different: wt('b7', 'different'),
  question: wt('b8', 'question'), buy: wt('b8', 'buy'),
};

/* ---------- Phasen ---------- */
const ph = t => ({
  hook: 1 - ease(t, bs('b1') - .2, .5),
  rows: ease(t, bs('b1') - .2, .5) * (1 - ease(t, bs('b3') - .25, .4)),
  chart: ease(t, bs('b3') - .1, .45) * (1 - ease(t, bs('b7') - .25, .4)),
  compare: ease(t, bs('b7') - .1, .4) * (1 - ease(t, bs('b8') - .25, .4)),
  question: ease(t, bs('b8') - .1, .4),
});
const C0 = [540, 640];
const A_HOOK = [300, 1010], B_HOOK = [780, 1010], A_ROW = [220, 760], B_ROW = [220, 1200];
const mix = (p, q, k) => [lerp(p[0], q[0], k), lerp(p[1], q[1], k)];

function hook(t, a) {
  if (a <= 0) return;
  ctx.save(); ctx.globalAlpha *= a;
  burst(C0[0], C0[1], t, -.25, { n: 110, r: 105, dur: 1.6 });
  ring(C0[0], C0[1], 92, t, ease(t, -.3, .6), { icon: 'dollar', glow: .6, ticks: 72 });
  hudLabel('SAME RAISE', C0[0], C0[1] + 150, ease(t, T.same, .3));
  const kA = ease(t, T.coworkers - .1, .5), kB = ease(t, T.coworkers + .1, .5);
  const pA = path([[C0[0] - 60, C0[1] + 75], A_HOOK.map((v, i) => v + (i ? -95 : 40))]);
  const pB = path([[C0[0] + 60, C0[1] + 75], B_HOOK.map((v, i) => v + (i ? -95 : -40))]);
  dotted(pA, kA); dotted(pB, kB);
  coins(pA, t, T.n300, be('h1') + .2, { every: .45, travel: .8 });
  coins(pB, t, T.n300 + .2, be('h1') + .2, { every: .45, travel: .8 });
  hudNumber('+$300', '', C0[0], 430, ease(t, T.n300 - .05, .3, E.outBack), { size: 92 });
  hudLabel('PER MONTH', C0[0], 505, ease(t, T.month - .1, .3));
  ctx.restore();
}
function people(t, P) {
  const k = ease(t, bs('b1') - .3, .7, E.inOutCubic);
  const a = (1 - ease(t, bs('b3') - .25, .4)) * (1 - 0);
  if (a <= 0) return;
  const A = mix(A_HOOK, A_ROW, k), B = mix(B_HOOK, B_ROW, k), r = lerp(80, 70, k);
  const dimA = 1 - .55 * ease(t, bs('b2') - .1, .4);
  const dimB = 1 - .55 * (ease(t, bs('b1') - .1, .3) * (1 - ease(t, bs('b2') - .1, .3)));
  ring(A[0], A[1], r, t, ease(t, T.coworkers - .1, .5), { icon: 'person', label: 'COWORKER A', alpha: a * dimA });
  ring(B[0], B[1], r, t, ease(t, T.coworkers + .1, .5), { icon: 'person', label: 'COWORKER B', alpha: a * dimB, dir: -1 });
  hudLabel('LIFESTYLE', A[0], A[1] - r - 50, a * dimA * ease(t, T.life1 - .1, .3), { color: HUD.fg, weight: 800 });
  hudLabel('SAME LIFE', B[0], B[1] - r - 50, a * dimB * ease(t, T.same2 - .1, .3), { color: HUD.fg, weight: 800 });
}
function rows(t, a) {
  if (a <= 0) return;
  ctx.save(); ctx.globalAlpha *= a;
  const dimA = 1 - .55 * ease(t, bs('b2') - .1, .4);
  // Reihe A: Lebensstil
  const pCar = path([[A_ROW[0] + 110, A_ROW[1]], [520 - 110, A_ROW[1]]]);
  const pPhone = path([[A_ROW[0] + 90, A_ROW[1] - 60], [500, 610], [800 - 80, A_ROW[1] - 60]]);
  ctx.save(); ctx.globalAlpha *= dimA;
  dotted(pCar, ease(t, T.upgrades, .6)); dotted(pPhone, ease(t, T.car, .6));
  ring(520, A_ROW[1], 70, t, ease(t, T.car - .15, .5), { icon: 'car', label: 'NICER CAR' });
  ring(800, A_ROW[1], 70, t, ease(t, T.phone - .15, .5), { icon: 'phone', label: 'NEWER PHONE', dir: -1 });
  coins(pCar, t, T.car - .2, bs('b2') + .2, { every: .5, travel: .7 });
  coins(pPhone, t, T.phone - .2, bs('b2') + .2, { every: .5, travel: .8 });
  ctx.restore();
  // Reihe B: investiert
  const pInv = path([[B_ROW[0] + 110, B_ROW[1]], [520 - 110, B_ROW[1]]]);
  dotted(pInv, ease(t, T.invests - .1, .6));
  ring(520, B_ROW[1], 70, t, ease(t, T.invests - .15, .5), { icon: 'chart', label: 'INVESTED', glow: .5 });
  coins(pInv, t, T.invests, bs('b3') + .2, { every: .4, travel: .7 });
  ctx.restore();
}

/* ---------- Diagramm ---------- */
const CH = { x0: 170, x1: 930, y0: 1250, y1: 720, vmax: 380000 };
const cx = yr => lerp(CH.x0, CH.x1, yr / 30), cy = v => lerp(CH.y0, CH.y1, v / CH.vmax);
function yearAt(t) {
  const keys = [[bs('b3'), T.year1 + .2, 0, 1], [T.ten - .1, T.k50 + .1, 1, 10], [T.thirty - .1, T.k360 + .1, 10, 30]];
  let y = 0;
  for (const [a, b, v0, v1] of keys) { if (t >= b) y = v1; else if (t > a) return lerp(v0, v1, E.inOutCubic(prog(t, a, b))); }
  return y;
}
function chart(t, a) {
  if (a <= 0) return;
  ctx.save(); ctx.globalAlpha *= a;
  const Y = yearAt(t);
  // Achsen
  line(CH.x0, CH.y0, CH.x1, CH.y0, 'rgba(255,255,255,.55)', 2); line(CH.x0, CH.y0, CH.x0, CH.y1 - 20, 'rgba(255,255,255,.55)', 2);
  for (const yr of [0, 10, 20, 30]) { line(cx(yr), CH.y0, cx(yr), CH.y0 + 12, 'rgba(255,255,255,.55)', 2); hudLabel(yr === 0 ? 'YEAR 0' : String(yr), cx(yr), CH.y0 + 40, 1, { size: 20, spacing: 3 }); }
  // Eingezahlt (gerade Linie) + Wachstum (Fläche dazwischen)
  const kPut = ease(t, T.put - .1, .8, E.inOutCubic), kGrow = ease(t, T.rest - .1, .7);
  if (kGrow > 0) {
    ctx.save(); ctx.globalAlpha *= kGrow; ctx.beginPath();
    for (let yr = 0; yr <= 30; yr += .25) ctx.lineTo(cx(yr), cy(fv(yr)));
    for (let yr = 30; yr >= 0; yr -= .25) ctx.lineTo(cx(yr), cy(MONTHLY * 12 * yr));
    ctx.closePath(); ctx.fillStyle = 'rgba(255,255,255,0.10)'; ctx.fill();
    ctx.clip(); ctx.strokeStyle = 'rgba(255,255,255,0.18)'; ctx.lineWidth = 2;
    for (let x = CH.x0 - 600; x < CH.x1; x += 18) { ctx.beginPath(); ctx.moveTo(x, CH.y0); ctx.lineTo(x + 520, CH.y1); ctx.stroke(); }
    ctx.restore();
  }
  if (kPut > 0) {
    ctx.save(); ctx.setLineDash([10, 9]); ctx.strokeStyle = 'rgba(255,255,255,.7)'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(cx(0), cy(0)); ctx.lineTo(cx(30 * kPut), cy(MONTHLY * 12 * 30 * kPut)); ctx.stroke(); ctx.restore();
  }
  // Coworker A: nichts angelegt
  ctx.save(); ctx.setLineDash([4, 10]); ctx.strokeStyle = 'rgba(255,255,255,.45)'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(cx(0), cy(0) - 2); ctx.lineTo(cx(Math.max(Y, .01)), cy(0) - 2); ctx.stroke(); ctx.restore();
  // Coworker B: Kurve bis zum aktuellen Jahr
  ctx.save(); ctx.strokeStyle = HUD.fg; ctx.lineWidth = 5; ctx.shadowColor = '#fff'; ctx.shadowBlur = 16; ctx.lineJoin = 'round';
  ctx.beginPath(); for (let yr = 0; yr <= Y + 1e-6; yr += .1) ctx.lineTo(cx(yr), cy(fv(yr))); ctx.stroke(); ctx.restore();
  const [px, py] = [cx(Y), cy(fv(Y))];
  ctx.save(); ctx.fillStyle = HUD.fg; ctx.shadowColor = '#fff'; ctx.shadowBlur = 24; ctx.beginPath(); ctx.arc(px, py, 9, 0, 7); ctx.fill(); ctx.restore();
  // "kaum sichtbar": Puls um den Punkt nach Jahr 1
  if (between(t, T.barely - .2, T.ten - .2)) {
    const k = (((t - T.barely) * 1.4) % 1 + 1) % 1;
    ctx.save(); ctx.strokeStyle = HUD.fg; ctx.globalAlpha *= 1 - k; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(px, py, 14 + k * 60, 0, 7); ctx.stroke(); ctx.restore();
    hudLabel('+' + money(fv(1)), px + 20, py - 50, ease(t, T.barely - .2, .3), { align: 'left', color: HUD.fg, size: 26, spacing: 2 });
  }
  // Beschriftungen
  hudLabel('COWORKER A  ·  $0', CH.x1, cy(0) - 34, ease(t, T.year1, .4), { align: 'right', size: 20, spacing: 3 });
  hudLabel('PUT IN ' + money(108000), cx(30) - 6, cy(108000) + 40, ease(t, T.put + .5, .4), { align: 'right', size: 22, spacing: 3, color: HUD.fg });
  hudLabel('GROWTH ' + money(fv(30) - 108000), cx(22), cy(200000), kGrow, { align: 'right', size: 24, spacing: 3, color: HUD.fg, weight: 800 });
  hudNumber(money(fv(Y)), `COWORKER B  ·  YEAR ${Math.round(Y)}`, 540, 520, 1, { size: 92 });
  txt('Example: $300/month, 7% avg. yearly return, compounded monthly. Not financial advice.', 540, 1345, { font: 'Inter', weight: 500, size: 19, color: '#6d6d73' });
  ctx.restore();
}
function compare(t, a) {
  if (a <= 0) return;
  ctx.save(); ctx.globalAlpha *= a;
  const A = [290, 880], B = [790, 880];
  ring(A[0], A[1], 78, t, 1, { icon: 'person', label: 'COWORKER A', alpha: 1 - .45 * ease(t, T.different, .4) });
  ring(B[0], B[1], 78, t, 1, { icon: 'person', label: 'COWORKER B', glow: ease(t, T.different, .4), dir: -1 });
  hudLabel('SAME JOB', 540, 850, ease(t, T.job - .1, .3), { color: HUD.fg, weight: 800, size: 22, spacing: 4 });
  hudLabel('SAME RAISE', 540, 910, ease(t, T.raise7 - .1, .3), { color: HUD.fg, weight: 800, size: 22, spacing: 4 });
  const kd = ease(t, T.different - .1, .4, E.outBack);
  hudNumber('$0', 'LIFESTYLE', A[0], 1150, kd, { size: 64 });
  hudNumber(money(fv(30)), 'FUTURE', B[0], 1150, kd, { size: 64 });
  ctx.restore();
}
function question(t, a) {
  if (a <= 0) return;
  ctx.save(); ctx.globalAlpha *= a;
  ring(540, 790, 110, t, ease(t, bs('b8') - .1, .6), { icon: 'question', label: 'YOUR NEXT RAISE', glow: .5, ticks: 80 });
  const k = ease(t, T.buy - .25, .5);
  ring(310, 1200, 74, t, k, { icon: 'car', label: 'LIFESTYLE', alpha: .85 });
  ring(770, 1200, 74, t, k, { icon: 'chart', label: 'FUTURE', dir: -1 });
  hudLabel('OR', 540, 1200, k, { color: HUD.fg, size: 26 });
  const p1 = path([[480, 890], [340, 1100]]), p2 = path([[600, 890], [740, 1100]]);
  dotted(p1, k, .8); dotted(p2, k, .8);
  ctx.restore();
}

function draw(ctx, t) {
  hudBackground();
  const z = 1.12 * (1 + .04 * prog(t, 0, TL.duration)); // Hochformat: größer und etwas tiefer
  ctx.save(); ctx.translate(540, 960); ctx.scale(z, z); ctx.translate(-540, -880);
  const P = ph(t);
  hook(t, P.hook);
  people(t);
  rows(t, P.rows);
  chart(t, P.chart);
  compare(t, P.compare);
  question(t, P.question);
  ctx.restore();
  hudFinish(t);
  if (CAPTIONS) captions(t, { y: 1480, size: 70, font: 'Inter', weight: 800, stroke: 0 });
}

function cues() {
  cue(0, 'riser', .25); cue(.05, 'whoosh', .35);
  cue(T.coworkers + .2, 'pop', .3); cue(T.coworkers + .4, 'pop', .3);
  cue(T.n300 + .5, 'ding', .3);
  for (let x = T.n300; x < be('h1'); x += .45) cue(x + .75, 'tick', .18);
  cue(bs('b1') - .2, 'whoosh', .25);
  cue(T.car + .3, 'pop', .35); cue(T.phone + .3, 'pop', .35);
  cue(T.invests + .4, 'pop', .35);
  for (let x = T.invests; x < bs('b3'); x += .4) cue(x + .7, 'tick', .18);
  cue(bs('b3') - .2, 'whoosh', .3);
  cue(T.barely + .3, 'tick', .4);
  cue(T.ten - .1, 'riser', .3); cue(T.thirty - .1, 'riser', .45); cue(T.k360 + .15, 'ding', .45);
  cue(T.put + .4, 'whoosh', .25); cue(T.growth + .4, 'ding', .35);
  cue(bs('b7') - .2, 'whoosh', .3); cue(T.different + .4, 'impact', .45);
  cue(bs('b8') - .2, 'whoosh', .3); cue(T.buy + .3, 'pop', .4); cue(T.buy + .45, 'pop', .4);
}
