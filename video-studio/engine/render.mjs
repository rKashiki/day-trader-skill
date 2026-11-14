// Rendert videos/<slug>/scene.html Frame für Frame mit Playwright und baut das fertige MP4.
//
//   node engine/render.mjs videos/<slug>                 # komplettes Video -> out/<slug>.mp4
//   node engine/render.mjs videos/<slug> --sheet 24      # Kontaktbogen mit 24 Standbildern (schnelle Kontrolle)
//   node engine/render.mjs videos/<slug> --stills 0.5,3  # einzelne Standbilder
//   node engine/render.mjs videos/<slug> --mux           # nur Ton neu mischen + muxen (Frames bleiben)
//   Optionen: --fps 30  --workers 3  --from 10 --to 20
import { createRequire } from 'node:module';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { spawn, execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const { chromium } = createRequire(import.meta.url)('playwright'); // global installiert (NODE_PATH)

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const videoDir = path.resolve(args[0]);
const slug = path.basename(videoDir);
const opt = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d; };
const FPS = +opt('fps', 30);
const WORKERS = +opt('workers', 3);
const build = path.join(videoDir, 'build');
const timeline = JSON.parse(fs.readFileSync(path.join(build, 'timeline.json'), 'utf8'));

// Kleiner Static-Server, damit Fonts/Skripte ohne file://-CORS-Probleme laden.
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.woff2': 'font/woff2', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml' };
const server = http.createServer((req, res) => {
  const p = path.join(ROOT, decodeURIComponent(new URL(req.url, 'http://x').pathname));
  if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'content-type': MIME[path.extname(p)] || 'application/octet-stream' });
  fs.createReadStream(p).pipe(res);
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}`;
const sceneUrl = `${base}/${path.relative(ROOT, videoDir)}/scene.html`;

const browser = await chromium.launch();
async function openPage() {
  const page = await browser.newPage({ viewport: { width: 1080, height: 1920 } });
  page.on('pageerror', e => { console.error('Szenenfehler:', e.message); process.exitCode = 1; });
  await page.addInitScript(tl => { window.TIMELINE = tl; }, timeline);
  await page.goto(sceneUrl);
  await page.evaluate(async () => {
    await Promise.all([document.fonts.load('100px Anton'), document.fonts.load('900 100px Inter'), document.fonts.load('400 40px "JetBrains Mono"')]);
    await document.fonts.ready;
  });
  return page;
}
const grab = async (page, t, q = 0.9) => Buffer.from((await page.evaluate(([t, q]) => window.frameData(t, q), [t, q])).split(',')[1], 'base64');

try {
  const sheet = opt('sheet'), stills = opt('stills');
  if (sheet || stills) {
    const page = await openPage();
    const dir = path.join(build, 'stills'); fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir, { recursive: true });
    const from = +opt('from', 0), to = +opt('to', timeline.duration - 0.05);
    const times = stills ? stills.split(',').map(Number) : Array.from({ length: +sheet }, (_, i) => from + (to - from) * i / (+sheet - 1));
    for (const [i, t] of times.entries()) fs.writeFileSync(path.join(dir, `s${String(i).padStart(3, '0')}_${t.toFixed(2)}.jpg`), await grab(page, t, 0.85));
    if (sheet) {
      const cols = Math.min(8, times.length), rows = Math.ceil(times.length / cols);
      const out = path.join(build, 'sheet.jpg');
      execFileSync('ffmpeg', ['-nostdin', '-v', 'error', '-y', '-pattern_type', 'glob', '-i', path.join(dir, '*.jpg'),
        '-vf', `scale=270:-1,tile=${cols}x${rows}:padding=6:color=0x222222`, '-frames:v', '1', out]);
      console.log('Kontaktbogen:', out, '| Zeiten:', times.map(t => t.toFixed(1)).join(' '));
    } else console.log('Standbilder in', dir);
  } else {
    const t0 = Date.now();
    const total = Math.ceil(timeline.duration * FPS);
    const f0 = Math.floor(+opt('from', 0) * FPS), f1 = Math.min(total, Math.ceil(+opt('to', timeline.duration) * FPS));
    const n = f1 - f0, per = Math.ceil(n / WORKERS);
    const parts = Array.from({ length: WORKERS }, (_, w) => f0 + w * per < f1 ? path.join(build, `part${w}.mp4`) : null);
    if (!args.includes('--mux')) await Promise.all(Array.from({ length: WORKERS }, async (_, w) => {
      const a = f0 + w * per, b = Math.min(f1, a + per);
      if (a >= b) return;
      const out = parts[w];
      const page = await openPage();
      const ff = spawn('ffmpeg', ['-nostdin', '-v', 'error', '-y', '-f', 'image2pipe', '-c:v', 'mjpeg', '-framerate', String(FPS), '-i', '-',
        '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-pix_fmt', 'yuv420p', out], { stdio: ['pipe', 'inherit', 'inherit'] });
      for (let f = a; f < b; f++) {
        const buf = await grab(page, f / FPS);
        if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
        if (w === 0 && (f - a) % 90 === 0) process.stdout.write(`\r  Frames: ${Math.round((f - a) / (b - a) * 100)}% (Worker 0)   `);
      }
      ff.stdin.end();
      await new Promise((r, j) => ff.on('close', c => c === 0 ? r() : j(new Error('ffmpeg ' + c))));
    }));
    console.log(`\n  ${n} Frames in ${((Date.now() - t0) / 1000).toFixed(1)}s`);

    // Sound-Cues aus der Szene holen und mischen
    const page = await openPage();
    const cues = await page.evaluate(() => window.getCues());
    fs.writeFileSync(path.join(build, 'cues.json'), JSON.stringify(cues, null, 1));
    execFileSync('python3', [path.join(ROOT, 'engine', 'audio.py'), 'mix', videoDir], { stdio: 'inherit' });

    const list = path.join(build, 'parts.txt');
    fs.writeFileSync(list, parts.filter(Boolean).map(p => `file '${p}'`).join('\n'));
    fs.mkdirSync(path.join(ROOT, 'out'), { recursive: true });
    const final = path.join(ROOT, 'out', `${slug}.mp4`);
    execFileSync('ffmpeg', ['-nostdin', '-v', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', list,
      '-ss', String(f0 / FPS), '-i', path.join(build, 'audio.wav'), '-map', '0:v', '-map', '1:a', '-c:v', 'copy',
      '-af', 'loudnorm=I=-14:TP=-1.5:LRA=11', '-ar', '48000', '-c:a', 'aac', '-b:a', '192k', '-shortest', '-movflags', '+faststart', final]);
    console.log('Fertig:', final);
  }
} finally {
  await browser.close();
  server.close();
}
