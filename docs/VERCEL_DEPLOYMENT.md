# Vercel deployment verification

Verified on 2026-10-11.

- Production: https://accessform-mission26.vercel.app
- Project: k-246f/accessform-mission26
- Deployment: dpl_HFp7f5EVibNSoUNWCKp25EEKXQ9q
- State: READY (Vercel CLI).
- Unauthenticated HEAD of production URL: HTTP 200.
- Public scholarship JSON served successfully.
- In-app browser: Try demo → sample answers → review → confirm → Submitted (synthetic data).
- Service-worker installation reported ready on deployed app. Physical offline test on Vercel remains a separate check.
- COOP same-origin and COEP require-corp headers verified.
- Uploaded artifact: 28 static files, approximately 83 KB uploaded; excludes speech models, server code, submissions and credentials.
- Browser voice remains explicitly unavailable. Use localhost for installed native voice.
- Screenshot: test-results/vercel-submitted.jpg (local, excluded from version control and deployments).

Redeploy with `npm run build`, `node scripts/prepare-vercel.mjs`, then `VERCEL_TELEMETRY_DISABLED=1 npx --yes vercel@63.1.2 deploy .deploy/vercel-web --prod --yes`. The prepared folder retains its .vercel project link.
