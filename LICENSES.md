# AccessForm dependency and asset licenses

Verified on 2026-10-11. The app contains no analytics SDK, third-party fonts, stock imagery, paid AI API, browser Web Speech API, or cloud speech service.

## Application and browser assets

| Component | Version / source | License | Verification |
|---|---|---|---|
| AccessForm source, JSON forms, sample persona, SVG icon and CSS | This repository; newly authored | GPL-3.0-or-later | LICENSE; original project assets |
| Browser frontend and shared engine | Plain ES modules; no third-party UI library | GPL-3.0-or-later | This repository |
| WebSocket library `ws` | 8.18.3 | MIT | Installed node_modules/ws/LICENSE; copy at licenses/ws-MIT.txt; [upstream](https://github.com/websockets/ws/blob/8.18.3/LICENSE) |
| Node.js runtime | Tested with 26.8.2; minimum supported 22 | MIT for Node-origin code; bundled dependencies retain their own notices | [Exact runtime license and bundled dependency notices](https://github.com/nodejs/node/blob/v26.8.2/LICENSE) |

The Node runtime and native engines are installed separately and are not included in the static deployment. `ws` is the only npm runtime dependency and has no required transitive npm dependencies in this lockfile. Optional bufferutil/utf-8-validate accelerators are not installed. No third-party CSS, fonts, photographs, or icon set is used. System font rendering is provided by the user's operating system.

## Local voice

| Component | Version / model | License | Verification |
|---|---|---|---|
| whisper.cpp | 1.9.5 | MIT | [Upstream license](https://github.com/ggml-org/whisper.cpp/blob/master/LICENSE); installed native package metadata |
| Whisper base.en / small.en weights | Converted GGML files; exact local checksums in docs/VOICE_LICENSES.md | MIT | [OpenAI explicitly licenses code and weights MIT](https://github.com/openai/whisper#license) |
| eSpeak NG and standard English voice | 1.52.0 | GPL-3.0-or-later | [Versioned COPYING](https://github.com/espeak-ng/espeak-ng/blob/1.52.0/COPYING); no MBROLA voice |
| libomp | 23.1.3 | MIT (installed distributor declaration) | docs/VOICE_LICENSES.md, installed formula metadata |
| ggml | 0.26.0 | MIT | docs/VOICE_LICENSES.md |
| llama.cpp | 0.6.0_1 | MIT | docs/VOICE_LICENSES.md |
| SDL3 | 3.4.16 / 3.4.18 installed | Zlib | docs/VOICE_LICENSES.md |
| sdl2-compat | 2.32.72 / 2.32.74 installed | Zlib | docs/VOICE_LICENSES.md |
| OpenSSL | 4.0.3 | Apache-2.0 | docs/VOICE_LICENSES.md |
| ca-certificates | 2026-08-13 / 2026-09-25 installed | MPL-2.0 | docs/VOICE_LICENSES.md |
| pcaudiolib | 1.3 | GPL-3.0-or-later | docs/VOICE_LICENSES.md |

Native dependency license declarations, exact installed versions, formula links, and model fingerprints are in [docs/VOICE_LICENSES.md](docs/VOICE_LICENSES.md). Homebrew formula metadata is a distributor declaration, not a source-by-source audit of every native binary component. Preserve installed upstream license notices when moving or redistributing native packages; this static site does not redistribute them.

## Not included / not verified

BrowserWasmBackend and EspeakWasmTTS are availability-gated adapters. No Vosk model or eSpeak WASM distribution is bundled, and no functioning browser voice is claimed. Quest/A-Frame is not included. Any later dependency or model must have its exact license added here before inclusion.

macOS, browsers, hardware, hosting services and coding assistants are execution/development infrastructure; they are not claimed to be open-source application components. If the organizer's rule covers this infrastructure too, that needs their interpretation.

## Deployment tooling

Vercel CLI 63.1.2 is used only to upload the static build; it is not bundled in the application. Its source repository uses Apache-2.0, verified from [the official license](https://github.com/vercel/vercel/blob/main/LICENSE) on 2026-10-11. CLI telemetry is disabled with VERCEL_TELEMETRY_DISABLED=1. Vercel hosting itself is an external hosting service, not an open-source runtime dependency.
