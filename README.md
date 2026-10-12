# AccessForm

A synthetic application demo for MISSION ’26. One shared form engine supports typed commands, keyboard operation, switch scanning, correction, review and explicit confirmation. Local voice uses open-source engines; browser voice is unavailable pending a verified WASM implementation and benchmark.

## Run locally

On this prepared Mac:

```sh
./start.sh
```

Open **http://127.0.0.1:4173**. Node.js 22+ is required. First-time setup on a different machine: `npm ci`, install whisper.cpp and eSpeak NG, then `./scripts/setup-voice.sh` while online. Thereafter normal startup downloads nothing. See [voice setup](docs/VOICE.md). Synthetic local submissions are saved under `submissions/` only after confirmation; they are not served publicly.

## Static web build

```sh
npm run build
npm run preview:web
```

Open **http://127.0.0.1:4174**. `dist/` is a complete static site. It requires no server API, model download, or external library for typed, keyboard, switch or caption modes. Web submissions are stored in localStorage with an explicit JSON download. Clearing browser storage deletes that copy.

Production Vercel URL: https://accessform-mission26.vercel.app

Deployment reached READY on 2026-10-11. Unauthenticated HTTP access returned 200, and the live browser flow completed sample fill → review → explicit confirmation → submitted screen.

Prepare the exact static deployment:

```sh
npm run build
node scripts/prepare-vercel.mjs
VERCEL_TELEMETRY_DISABLED=1 npx --yes vercel@63.1.2 deploy .deploy/vercel-web --prod
```

This uploads only the static artifact. Local speech models, submissions, server code and credentials are excluded. Vercel CLI telemetry is disabled for the command.

Netlify uses `netlify.toml`; Vercel uses `vercel.json`; Cloudflare Pages can use build command `npm run build`, output `dist`; GitHub Pages serves the contents of `dist` including `.nojekyll`. Subpath-relative assets support project Pages URLs. `_headers` supplies COOP/COEP for compatible static hosts. GitHub Pages cannot add these headers; any future threaded WASM backend must account for that. No browser WASM model is currently shipped.

The service worker precaches public app assets after the first successful visit. It never caches API responses or submissions. It cannot make a first-ever offline visit work. Offline verification status is in docs/TEST_CHECKLIST.md.

## Test

```sh
npm test
npm run sim
npm run benchmark
```

The benchmark processes 20 synthetic audio clips locally and writes measured results. It is not a user study or a measurement of human microphone accuracy. See docs/VOICE.md and docs/voice-benchmark.json.

Judge instructions: [JUDGE_GUIDE.md](JUDGE_GUIDE.md). Printable sample: [persona.html](persona.html). Demo script and backup recording plan: [docs/DEMO_SCRIPT.md](docs/DEMO_SCRIPT.md). Licenses: [LICENSES.md](LICENSES.md).

## Architecture

- `shared/engine.js`: pure ES module; form state, command handling, spelling, validation and confirm gate.
- `shared/transports.js`: InProcessTransport and WebSocketTransport.
- `forms/*.json`: interchangeable synthetic form definitions.
- `app.js`, `index.html`, `styles.css`: shared interface and accessible controls.
- `voice/`: local PCM capture, VAD, local speech adapters, honest browser availability gates.
- `server/index.js`: localhost-only HTTP/WebSocket server; no request logs.
- `sw.js`: offline static asset cache.

Contract v2 is retained. `state.field` is null while idle/submitted. The form engine's spell mode accepts a complete spelled value in each utterance; numbered character corrections change a single existing character. Voice commands use conservative aliases for navigation only; confirmation is never fuzzy-matched.

## Current limitations

- Browser ASR/TTS and Vosk fallback are not implemented; the UI labels browser voice unavailable.
- Human microphone tests, VoiceOver checks, three-device tests, physical Wi-Fi-off tests and backup-video recording must be recorded explicitly; no pass is inferred from automated tests.
- Synthetic benchmark quality does not establish real-speaker usability.
- Quest is excluded until separately approved.
- Use synthetic data only. The app has no analytics or cloud speech requests. Hosting providers receive normal asset requests; application answers/audio are not sent to them.

## Work in progress: next-phase voice gate

The latest source includes push-to-talk and heard-text confirmation controls, a small.en default, and an optional persistent Whisper backend. The 20-prompt gate corpus/scorer and server helper exist, but the recording page and server routing are not integrated yet. Human headset recordings and outcome-accuracy measurements have not been performed. These uncompleted changes are not claimed to be part of the verified Vercel deployment.
