# Installed native voice dependency licenses

Verified 2026-10-11 using installed Homebrew formula metadata (`brew info --json=v2`), retained locally in `.voice/native-formulae.json`. These are separately installed native dependencies, not bundled static-site assets. Formula metadata is the package distributor’s licensing declaration; upstream text is linked where independently inspected in VOICE.md.

| Package | Installed version(s) | Declared license | Source |
|---|---|---|---|
| whisper.cpp | 1.9.5 | MIT | [upstream](https://github.com/ggml-org/whisper.cpp), [formula](https://github.com/Homebrew/homebrew-core/blob/main/Formula/w/whisper.cpp.rb) |
| espeak-ng | 1.52.0 | GPL-3.0-or-later | [upstream](https://github.com/espeak-ng/espeak-ng), [formula](https://github.com/Homebrew/homebrew-core/blob/main/Formula/e/espeak-ng.rb) |
| libomp | 23.1.3 | MIT | [upstream](https://openmp.llvm.org/), [formula](https://github.com/Homebrew/homebrew-core/blob/main/Formula/lib/libomp.rb) |
| ggml | 0.26.0 | MIT | [upstream](https://github.com/ggml-org/ggml), [formula](https://github.com/Homebrew/homebrew-core/blob/main/Formula/g/ggml.rb) |
| llama.cpp | 0.6.0_1 | MIT | [upstream](https://llama.app), [formula](https://github.com/Homebrew/homebrew-core/blob/main/Formula/l/llama.cpp.rb) |
| sdl3 | 3.4.16, 3.4.18 | Zlib | [upstream](https://libsdl.org/), [formula](https://github.com/Homebrew/homebrew-core/blob/main/Formula/s/sdl3.rb) |
| sdl2-compat | 2.32.72, 2.32.74 | Zlib | [upstream](https://github.com/libsdl-org/sdl2-compat), [formula](https://github.com/Homebrew/homebrew-core/blob/main/Formula/s/sdl2-compat.rb) |
| openssl@4 | 4.0.3 | Apache-2.0 | [upstream](https://openssl-library.org), [formula](https://github.com/Homebrew/homebrew-core/blob/main/Formula/o/openssl@4.rb) |
| ca-certificates | 2026-08-13, 2026-09-25 | MPL-2.0 | [upstream](https://curl.se/docs/caextract.html), [formula](https://github.com/Homebrew/homebrew-core/blob/main/Formula/c/ca-certificates.rb) |
| pcaudiolib | 1.3 | GPL-3.0-or-later | [upstream](https://github.com/espeak-ng/pcaudiolib), [formula](https://github.com/Homebrew/homebrew-core/blob/main/Formula/p/pcaudiolib.rb) |

Whisper base.en model: MIT, code and model weights explicitly covered by [upstream license statement](https://github.com/openai/whisper#license). Converted file from [GGML distribution](https://huggingface.co/ggerganov/whisper.cpp). Exact local file size: 147,964,211 bytes. SHA-256: `a03779c86df3323075f5e796cb2ce5029f00ec8869eee3fdfb897afe36c6d002`.

Optional small.en converted model: same MIT upstream weight license. File size: 487,614,201 bytes. SHA-256: `c6138d6d58ecc8322097e0f987c32f1be8bb0a18532a3f88f734d1bbf9c41e5d`.
