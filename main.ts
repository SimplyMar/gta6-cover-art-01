// A working gta6-cover-art-01 entry (Node 22, standard library only): the app is this directory's app/ folder, plain
// static files a desktop browser loads offline (app/index.html and its ES modules, no library and no network
// request), and the program hands it in. It copies app/ and screenshots/ from beside this file to /output and writes
// /output/dossier.json, the summary the judge reads, with the vendored make.fun library. Only the plumbing, not the
// cover art the bounty asks for: Cover Snap, a plain one-photo square cover with a sunset tint and a bold caption,
// exported as a 1080 x 1080 PNG. Its two sample photos (app/samples/) were made for make.fun with an image model and
// are free to use. Build your own GTA-style cover maker in its place, put your 3 or 4 PNG or JPEG screenshots in
// screenshots/ (the first by name is the cover) and run it.
//
// Serve it locally with `node serve.ts`, then open http://localhost:8080.
// Outside the grader's container, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-app.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

mkdirSync(out, { recursive: true });
cpSync(join(here, 'app'), join(out, 'app'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(join(here, 'screenshots'))) cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });

// The scorer's own caps (reference/gate.json): only text_max_bytes shapes the bytes; the others refuse an entry the
// scorer would refuse (more than 4 screenshots or one over 256 KiB; more than 993 files in app/ or 48 MiB of app
// files, in all, or a path under app/ over 1000 bytes: app/ counts beside /output's own 1000-entry cap, its
// screenshots/ and dossier.json).
const dossierBytes = buildDossier(out, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  app_max_files: 993,
  app_max_bytes: 50331648,
  app_path_max_bytes: 1000,
});
writeFileSync(join(out, 'dossier.json'), dossierBytes);

// Print a concise build summary so a local run confirms the dossier shape at a glance.
try {
  const dossier = JSON.parse(Buffer.from(dossierBytes).toString());
  // The dossier's "## App" block is text, not structured JSON; its "Totals: N files and directories
  // (B bytes)" line is the one line worth echoing here.
  const totals = /Totals: (\d+) files and directories \((\d+) bytes\)/.exec(dossier.text ?? '');
  const images: Array<{ name: string; base64: string }> = Array.isArray(dossier.images) ? dossier.images : [];
  console.log('gta6-cover-art-01 build summary');
  console.log(`  output dir:   ${out}`);
  console.log(`  app files:    ${totals ? `${totals[1]} entries, ${totals[2]} bytes` : 'n/a'}`);
  console.log(`  screenshots:  ${images.length || 'n/a'}`);
  // Each screenshot's real byte size (decoded from its base64), checked against the scorer's 256 KiB
  // cap here, up front, instead of only finding out from a grader rejection later.
  for (const image of images) {
    const bytes = Buffer.from(image.base64, 'base64').length;
    const overCap = bytes > 262144 ? '  !! OVER 256 KiB CAP' : '';
    console.log(`    ${image.name}: ${bytes} bytes${overCap}`);
  }
  console.log(`  dossier size: ${dossierBytes.length} bytes`);
} catch (err) {
  console.log(`gta6-cover-art-01 build summary: wrote ${dossierBytes.length} bytes to dossier.json (could not parse for summary: ${(err as Error).message})`);
}
