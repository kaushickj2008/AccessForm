import { mkdir, readdir, readFile, writeFile, cp, rm, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
const out = path.join(root, 'dist');
const files = ['index.html', 'app.js', 'styles.css', 'sw.js', 'manifest.webmanifest', 'JUDGE_GUIDE.md', 'LICENSES.md', 'LICENSE', 'persona.html', '_headers'];
const directories = ['shared', 'forms', 'assets', 'licenses'];
await mkdir(out, { recursive: true });
const entries = [];
async function copy(file) {
  const from = path.join(root, file), info = await stat(from);
  if (info.isDirectory()) { for (const entry of await readdir(from)) await copy(path.join(file, entry)); }
  else { await mkdir(path.dirname(path.join(out, file)), { recursive: true }); await cp(from, path.join(out, file)); entries.push('./' + file.split(path.sep).join('/')); }
}
for (const file of [...files, ...directories]) await copy(file);
for (const file of await readdir(path.join(root, 'voice'))) if (file.endsWith('.js') && file !== 'server.js') await copy('voice/' + file);
for (const file of ['VOICE.md', 'VOICE_LICENSES.md', 'voice-benchmark.json', 'voice-benchmark-small.json', 'TEST_CHECKLIST.md', 'DEMO_SCRIPT.md']) {
  try { await copy('docs/' + file); } catch (error) { if (error.code !== 'ENOENT') throw error; }
}
const precache = JSON.stringify(entries.filter(p => !['./sw.js','./_headers'].includes(p)), null, 2);
await writeFile(path.join(root, 'precache.json'), precache);
await writeFile(path.join(out, 'precache.json'), precache);
await writeFile(path.join(out, '.nojekyll'), '');
console.log(`Built ${entries.length} static assets in dist/. No backend, models, submissions, or secrets included.`);
