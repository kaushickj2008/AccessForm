#!/bin/sh
set -eu
cd "$(dirname "$0")/.."
# Run once while online. Normal start.sh never installs or downloads anything.
if ! command -v whisper-cli >/dev/null 2>&1 || ! command -v espeak-ng >/dev/null 2>&1; then
  printf '%s\n' 'Install the open-source native engines first: brew install whisper-cpp espeak-ng' 'Then rerun this script. See docs/VOICE.md for license sources.'
  exit 1
fi
mkdir -p .voice/models
if [ ! -s .voice/models/ggml-base.en.bin ]; then
  curl -fL --retry 2 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.en.bin' -o .voice/models/ggml-base.en.bin.partial
  printf '%s\n' 'a03779c86df3323075f5e796cb2ce5029f00ec8869eee3fdfb897afe36c6d002  .voice/models/ggml-base.en.bin.partial' | shasum -a 256 -c -
  mv .voice/models/ggml-base.en.bin.partial .voice/models/ggml-base.en.bin
fi
node --input-type=module -e 'import {status} from "./voice/server.js"; const s=await status(); console.log(s.available?"Local speech ready. Disconnect Wi-Fi and run ./start.sh.":s.reason);process.exit(s.available?0:1)'
