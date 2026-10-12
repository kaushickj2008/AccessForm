# Verification checklist

Status is evidence, not a promise. Unchecked items are not verified.

- [x] Shared engine: required fields, errors, review, explicit confirm, undo, character correction.
- [x] Local WebSocket: same workflow, saved synthetic JSON, isolated sessions.
- [x] Static web: completes without local APIs or model downloads.
- [ ] Keyboard-only happy path with visible focus.
- [ ] Switch scanning selection and completion.
- [ ] No cross-origin requests from app code; no Web Speech API.
- [x] Local ASR/TTS verified on actual synthetic audio (20 utterances per model).
- [ ] Human microphone interaction tested with permission.
- [ ] VoiceOver labels, live announcements, errors and review read correctly.
- [ ] Static PWA offline reload after initial cache.
- [ ] Physical Wi-Fi-off local startup and voice.
- [ ] Three real devices tested.
- [x] Review does not save; confirm saves once.
- [x] Persistence failure preserves answers and offers retry (engine test).
- [ ] Backup recording captured and reviewed.

Automated results and remaining manual tests will be recorded here after integration.

## Observed integration results — 2026-10-11

- `npm test`: 12/12 passed, including real WebSocket/HTTP tests. `npm run sim`: 5/5 passed.
- In-app browser, local build: typed single-character correction changed Tast Student to Test Student and caption spelled the result; sample fill, review and explicit confirmation reached the submitted screen.
- In-app browser, static build: invalid email produced a readable error; corrected form reviewed and submitted without backend APIs.
- Static offline-origin test: stopped the web preview server, reloaded the cached app, filled and submitted successfully. This verifies cached operation with origin unavailable, not a physical Wi-Fi-off test.
- Native synthetic benchmarks: base.en raw word accuracy 46.03%; small.en 60.32%. See full reports for metric limitations and latency scope.
- Physical three-device and VoiceOver testing, human microphone testing, and physical Wi-Fi-off testing remain unverified.
