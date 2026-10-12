# Local voice implementation and honest limits

Microphone audio is captured with getUserMedia and the Web Audio API, averaged to 16 kHz mono PCM16 WAV, and sent only to the localhost server. This is not the Web Speech API. Energy VAD uses a configurable RMS threshold (default 0.012) and one second of trailing silence. It caps chunks at 25 seconds. The microphone pipeline discards samples while TTS or transcription is active. Background noise, quiet voices, pauses, speech differences, and room acoustics need actual microphone testing.

Local recognition runs whisper-cli as a separate process. Temporary WAV/transcript files have a private temporary directory and are removed in finally; there are no transcript/audio logs. Local TTS runs eSpeak NG as a separate process and returns WAV bytes through memory. Normal runtime does not download models or contact cloud services.

## Setup

Once while online, install native open-source dependencies with `brew install whisper-cpp espeak-ng`. Run `./scripts/setup-voice.sh` to download base.en into `.voice/models`. Then run `./start.sh` and turn Wi-Fi off. Installation is separate from normal startup. Custom installations can set WHISPER_BIN, WHISPER_MODEL and ESPEAK_BIN. Optional small.en benchmarking requires its model downloaded separately, then `WHISPER_MODEL=.voice/models/ggml-small.en.bin node scripts/benchmark-voice.mjs`.

## Browser gate

BrowserWasmBackend and EspeakWasmTTS implement the interfaces but deliberately report unavailable. No WASM binary/model is bundled, downloaded, or benchmarked. The web build retains typed, keyboard, switch and captions. It must not advertise a model download size or functioning browser voice. Vosk fallback is not implemented. These are incomplete optional features, not working fallbacks.

## Benchmark

`node scripts/benchmark-voice.mjs` generates exactly 20 synthetic utterances with eSpeak, converts them in memory to PCM16/16 kHz, and runs actual recognition. Results go to `docs/voice-benchmark.json`. It reports word edit distance divided by reference word count (WER), 1−WER word accuracy, and measured process latency including model loading. WER can exceed 100% with insertions. This is a synthetic pipeline benchmark, not real-speaker accuracy, accessibility validation, microphone latency, or a browser benchmark. To test recorded synthetic speech, pass a JSON manifest with exactly 20 `{ "text": "expected words", "wav": "path/to/file.wav" }` entries. No real identifiers.

## Verified upstream licenses

- whisper.cpp: MIT; official https://github.com/ggml-org/whisper.cpp/blob/master/LICENSE inspected 2026-10-11.
- Whisper model code and weights, including base.en/small.en: MIT; official https://github.com/openai/whisper#license explicitly covers code and model weights; https://github.com/openai/whisper/blob/main/LICENSE.
- Converted GGML model distribution: https://huggingface.co/ggerganov/whisper.cpp; upstream Whisper weight license applies. Model version is identified by local checksum after download.
- eSpeak NG: GPL-3.0-or-later; official version 1.52.0 README license section and COPYING: https://github.com/espeak-ng/espeak-ng/blob/1.52.0/README.md#license-information and https://github.com/espeak-ng/espeak-ng/blob/1.52.0/COPYING. Standard English voice data comes with this distribution; no MBROLA voice is used.

Native engines are installed separately, not redistributed with the static site. Include their versions and licenses in the project LICENSES.md. Any redistributed binary must include the applicable notices and source obligations. No third-party voice JavaScript dependency is used.

## Measured synthetic pipeline results (2026-10-11)

| Model | Raw word accuracy (1−WER) | Mean ASR latency | p50 | p95 |
|---|---:|---:|---:|---:|
| base.en | 46.03% | 439.05 ms | 205 ms | 317 ms |
| small.en | 60.32% | 467.85 ms | 441 ms | 550 ms |

See `voice-benchmark.json` and `voice-benchmark-small.json` for all 20 reference/hypothesis pairs. Base's first invocation took 4763 ms (cold initialization), which increases its mean above p95. Small's run followed base and was not an equally cold machine run. These are raw word comparisons; digit/email formatting differences count as errors, alongside genuine misrecognitions of short synthesized commands. Neither result establishes human speech accuracy. Do not advertise high accuracy based on these results. For a local trial with the stronger measured model: `WHISPER_MODEL=.voice/models/ggml-small.en.bin ./start.sh`. Both models are now on this machine, so no runtime download is needed.

Metal access failed inside the execution sandbox and succeeded outside it. If GPU use is unavailable, `WHISPER_CPU=1 ./start.sh` explicitly disables GPU. CPU performance has not been benchmarked.

Pausing listening fully discards microphone samples; use the visible Resume button or keyboard to resume. A spoken resume command cannot be heard while microphone processing is paused. This limitation is intentional and must remain visible.
