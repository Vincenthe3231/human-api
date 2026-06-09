# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Install dependencies
pnpm install

# Run dev server (Vercel loads .env.local, port 3002)
pnpm dev

# Run dev server (Vercel loads .env, port 3002)
pnpm exec vercel dev --listen 3002

# Deploy (preview)
pnpm exec vercel

# Deploy (production)
pnpm exec vercel --prod
```

No test suite is configured (`pnpm test` exits with an error).

## Architecture

Single-endpoint Vercel serverless API (`api/v1/recognize.ts`) for face recognition.

**Request flow:**
1. Receive `POST /api/v1/recognize` with `{ userId, image }` (base64)
2. Fetch face photo URLs from Supabase (`lib/supabase.ts`) using env-configured table/columns
3. Decode each photo URL → tensor via Sharp + TensorFlow.js CPU backend (`lib/decodeImage.ts`)
4. Run `@vladmandic/human` face detection on each reference image to build `referenceDescriptors[]`
5. Decode the submitted base64 image and run detection to get the probe embedding
6. Compare probe against all reference descriptors; take best similarity score
7. Return `{ humanFace, match, confidence? }` — match threshold is **0.8** (`lib/validate.ts`)

**Key constraints:**
- Uses `@vladmandic/human` WASM/CPU build (`human.node-wasm.js`) — not `tfjs-node` — for Node 24 / Vercel 250 MB bundle compatibility
- `lib/human.ts` uses `modelBasePath` pointed at jsDelivr CDN; models are fetched at runtime
- The serverless function is allocated 2048 MB / 60 s max (see `vercel.json`)
- Human instance and TF backend are module-level singletons (warm reuse across invocations)

**Supabase env vars** (see `.env.example`):

| Variable | Default | Purpose |
|---|---|---|
| `SUPABASE_URL` | — | Required |
| `SUPABASE_SECRET` | — | Service role key (required) |
| `SUPABASE_FACE_TABLE` | `profiles` | Table to query |
| `SUPABASE_FACE_FRONT_URL_COLUMN` | `''` | Front-face photo URL column |
| `SUPABASE_FACE_LEFT_URL_COLUMN` | `''` | Left-face photo URL column |
| `SUPABASE_FACE_RIGHT_URL_COLUMN` | `''` | Right-face photo URL column |
| `SUPABASE_USER_ID_COLUMN` | `id` | Primary key column |

At least one `SUPABASE_FACE_*_URL_COLUMN` must be set or no reference descriptors will be found.

## Known: `vercel dev` does not load `.env.local`

This is a framework-less, cloud-linked Vercel project. `vercel dev` injects env vars **only from the cloud "Development" environment** — it does **not** read `.env.local`. The cloud Development env is nearly empty (only `VERCEL_OIDC_TOKEN`), so all custom env vars are missing at runtime, causing silent failures (empty column names → early `return []` → `404 No registered face`).

**Fix:** use `pnpm dev` (defined in `package.json`), which runs `scripts/dev.mjs`. That script loads `.env.local` into `process.env` before spawning `vercel dev`, so the function inherits the correct values.

- **Never run** `vercel dev` directly — env vars will be missing.
- **Never run** `vercel env pull` — it pulls the empty Development env and overwrites `.env.local`.
- Local env lives in `.env.local`; deployed env lives in cloud Preview/Production (already set).
- `pnpm dev` reads `.env` if `.env.local` is absent (Node convention in `scripts/dev.mjs`).
