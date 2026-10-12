# AccessForm judge guide

This is a synthetic demo. It does not apply for a scholarship or open a bank account. Use the sample persona only. No real identity information.

## Open the demo

Local: run `./start.sh` from this folder, then open http://127.0.0.1:4173. One-time dependency and voice setup must already be complete for offline use. Web: use the published link in README, or `npm run build && npm run preview:web` for the static build on http://127.0.0.1:4174.

The browser build works immediately with typed answers, keyboard controls and switch scanning. Browser speech is visibly unavailable until verified WASM components pass the benchmark. Local voice uses whisper.cpp and eSpeak NG on the laptop. No Web Speech API or cloud speech services.

## Five tests with expected results

1. **Complete and confirm.** Choose keyboard mode and try the demo. Use “Fill with sample answers”, then Review. Check every field. Select Confirm submit. Expected: nothing is saved before confirmation; afterwards a “Submitted (synthetic data)” screen and JSON download are available. Local saves are in `submissions/`; web saves stay in browser storage.
2. **Fix one character.** Reset. Enter `Tast Student` for Full name. Use the typed command box to enter `change the second letter to e`. Expected: the answer becomes `Test Student`, and the caption spells the corrected name character by character. In local voice mode the same readback is spoken. Undo restores `Tast Student`.
3. **Validation and review.** Enter `bad-email` in the email field and continue. Expected: a plain-language error is shown; local voice speaks it. Enter `test.student@example.com`. Complete the form. At review, say/type `change my email` and edit. Expected: a correction requires a new review and explicit confirmation.
4. **Second form and alternative controls.** Load the synthetic bank form. Expected: fields come from the second JSON file with no code change. Navigate using Tab/Shift+Tab/Enter. Try switch mode using its on-screen instructions. Expected: visible focus and a selectable option without precise pointer interaction.
5. **Offline and voice honesty.** With all local dependencies installed, turn Wi-Fi off and run `./start.sh`. Expected: local keyboard mode works; local voice is available when the status says ready. For the static PWA, load online first, wait for “offline ready”, then disconnect and reload. Expected: cached non-voice modes work. A first-ever offline visit cannot work. Do not interpret the online indicator as proof of internet access or cache readiness.

## Sample persona

Full name: Test Student  
Email: test.student@example.com  
Phone: 9000012345  
Course: Accessible Computing  
Reason: Synthetic demo only  
Bank account type: savings

Print `persona.html` from the browser for a sample card.

## Boundaries

No user validation or WCAG conformance is claimed. VoiceOver testing and three physical-device testing are separate checks recorded in docs/TEST_CHECKLIST.md. Synthetic audio benchmarks are not human speech validation. Quest is not included without the project owner's go-ahead.
