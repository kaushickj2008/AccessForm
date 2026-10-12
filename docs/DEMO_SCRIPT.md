# Two-minute demo and backup plan

0:00–0:20 — “Repeated typing and precise clicking can make forms difficult for someone with limited hand mobility. AccessForm offers one form through voice, keyboard and switch controls.” Show the synthetic banner and privacy line.

0:20–0:55 — Start with Test Student. Use the verified local voice setup if rehearsed; typed commands are always available. Enter `Tast Student`, correct “change the second letter to e”, then hear/see character readback. Do not claim this was tested by people with disabilities.

0:55–1:20 — Fill the remaining synthetic answers using the judge panel. Show an invalid email and its understandable error. Correct it.

1:20–1:40 — Review all answers, explicitly confirm, show the synthetic submission. Explain that the local copy stays on the laptop and the web copy stays in browser storage.

1:40–2:00 — Load the bank form and show it is a JSON definition using the same engine. Invite the judge to try keyboard or switch mode. Mention clearly if browser voice is unavailable.

## Backup

Before the event freeze, record the same synthetic workflow on the laptop with Wi-Fi off. Capture the browser window and spoken output. Save a local MP4 and a second copy on removable storage. Replay to confirm the text is legible and audio works. A backup video has not been recorded by this build session. Keep the static `dist/` folder, `node_modules/`, native speech engines, and `.voice/models/` available locally. Rehearse `./start.sh` once after disconnecting Wi-Fi.
