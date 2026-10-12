import { cp, mkdir, readFile, writeFile, readdir, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

// Deploy only the audited static artifact, never localhost code or personal data.
const root = fileURLToPath(new URL('../', import.meta.url));
const destination = path.join(root, '.deploy/vercel-web');
await mkdir(destination, {recursive:true});
for (const entry of await readdir(destination)) {
  if(entry !== '.vercel') await rm(path.join(destination, entry), {recursive:true, force:true});
}
await cp(path.join(root, 'dist'), destination, {recursive:true});
const config = JSON.parse(await readFile(path.join(root, 'vercel.json'), 'utf8'));
await writeFile(path.join(destination, 'vercel.json'), JSON.stringify({
  framework: null,
  buildCommand: '',
  installCommand: '',
  outputDirectory: '.',
  headers: config.headers
}, null, 2) + '\n');
console.log('Vercel-ready static artifact: .deploy/vercel-web');
console.log('Deploy: VERCEL_TELEMETRY_DISABLED=1 npx vercel deploy .deploy/vercel-web --prod');
