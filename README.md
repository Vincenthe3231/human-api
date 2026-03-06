# Human API

Face recognition API that validates a captured face against a registered face stored in Supabase. Built with [@vladmandic/human](https://github.com/vladmandic/human), TensorFlow.js (Node), and Vercel serverless functions.

## Features

- **Face detection** — Detects whether the submitted image contains a human face.
- **Face matching** — Compares the face embedding to the user’s reference descriptor derived from stored face photo URLs.
- **Supabase integration** — Reads face photo URLs from your Supabase table (e.g. `profiles` or `users`) to compute the reference descriptor.

**Full API reference:** [docs/API.md](docs/API.md)

## Prerequisites

- [Node.js](https://nodejs.org/) (v18+)
- [pnpm](https://pnpm.io/) (v10+)
- A Supabase project with a table that has face photo URL column(s) (image URLs used to compute the reference embedding)

## Installation

```bash
cd /home/vince/projects/human-api
pnpm install
```

## Environment variables

Create a `.env` file in the project root (see `.env.example` if present). For the recognize API you need:

| Variable | Required | Description |
|----------|----------|-------------|
| `SUPABASE_URL` | Yes | Your Supabase project URL |
| `SUPABASE_SECRET` | Yes | Supabase service role key (server-side only) |
| `SUPABASE_FACE_TABLE` | No | Table name (default: `profiles`) |
| `SUPABASE_FACE_URL_PHOTO_COLUMN` | No | If set, face is computed from this image URL |
| `SUPABASE_USER_ID_COLUMN` | No | Column for user id (default: `id`) |

## Development

Run the dev server (Vercel dev on port 3002):

```bash
cd /home/vince/projects/human-api
pnpm exec vercel dev --listen 3002
```

The API is available at `http://localhost:3002/api/v1/recognize`.

## API

### `POST /api/v1/recognize`

Validates a face image against the registered face for the given user.

**Request**

- **Method:** `POST`
- **Content-Type:** `application/json`
- **Body:**
  - `userId` (string, required) — User id used to look up the stored face in Supabase.
  - `image` (string, required) — Base64-encoded image (with or without `data:image/...;base64,` prefix).

**Response (200)**

- `humanFace` (boolean) — Whether a face was detected in the image.
- `match` (boolean) — Whether the face matched the stored face (similarity ≥ 0.8).
- `confidence` (number, optional) — Similarity score in 0–1, only when ≥ 0.8.
- `debug` — `status`, `message`, `requestId`, `timestamp`.

**Example**

```bash
curl -X POST http://localhost:3002/api/v1/recognize \
  -H "Content-Type: application/json" \
  -d '{"userId":"user-uuid","image":"/9j/4AAQ..."}'
```

**Error responses**

- `400` — Missing or invalid `userId` or `image`.
- `404` — No registered face for the user.
- `502` — Failed to fetch registered face from Supabase.
- `500` — Internal error (e.g. detection failure).

## Deployment

The project is set up for [Vercel](https://vercel.com). Deploy with:

```bash
pnpm exec vercel
```

Configure the same environment variables in your Vercel project. The `api/v1/recognize.ts` function uses 2048 MB memory and 60 s max duration (see `vercel.json`).

## License

ISC
