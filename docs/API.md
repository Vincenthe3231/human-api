# Human API — API Documentation

Face recognition API that validates a captured face image against a registered face stored in Supabase. This document describes how to call the API.

---

## Base URL

| Environment | Base URL |
|-------------|----------|
| Production  | `https://human-api-blond.vercel.app` |
| Local dev   | `http://localhost:3001` |

Replace with your actual Vercel project URL if different.

---

## Authentication

The API does not require authentication headers. Access control (e.g. who can call the endpoint) should be handled by your own gateway, API key middleware, or by keeping the endpoint server-side only (e.g. from a Next.js server action or API route).

---

## Endpoints

### Recognize face

Validates a face image against the registered face for the given user. The registered face is loaded from Supabase (either a stored embedding or a face photo URL).

**`POST /api/v1/recognize`**

#### Request

| Header            | Value                  |
|-------------------|------------------------|
| `Content-Type`    | `application/json`     |

**Body (JSON)**

| Field   | Type   | Required | Description |
|---------|--------|----------|-------------|
| `userId`| string | Yes      | User identifier used to look up the stored face in Supabase (e.g. Supabase auth user id or table primary key). |
| `image` | string | Yes      | Base64-encoded image. With or without data URL prefix (e.g. `data:image/jpeg;base64,...`). Max request body size: 10 MB. |

**Example request body**

```json
{
  "userId": "550e8400-e29b-41d4-a716-446655440000",
  "image": "/9j/4AAQSkZJRgABAQEASABIAAD..."
}
```

Or with data URL prefix:

```json
{
  "userId": "550e8400-e29b-41d4-a716-446655440000",
  "image": "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD..."
}
```

#### Response

All responses are JSON. The payload always includes `humanFace`, `match`, and `debug`.

**Success (HTTP 200)**

| Field        | Type    | Description |
|-------------|---------|-------------|
| `humanFace`| boolean | `true` if a face was detected in the image. |
| `match`    | boolean | `true` if the face matched the registered face (similarity ≥ 0.8). |
| `confidence`| number | *(optional)* Similarity score between 0 and 1. Only present when ≥ 0.8. Rounded to 2 decimal places. |
| `debug`    | object  | Request metadata (see below). |

**`debug` object**

| Field       | Type   | Description |
|------------|--------|-------------|
| `status`   | string | One of: `success`, `no_match`, `no_face`, `error`. |
| `message`  | string | Human-readable message. |
| `requestId`| string | Unique id for this request (for logging and support). |
| `timestamp`| string | ISO 8601 timestamp. |

**Example: face detected and matched**

```json
{
  "humanFace": true,
  "match": true,
  "confidence": 0.92,
  "debug": {
    "status": "success",
    "message": "Face detected and matched",
    "requestId": "m5x2k9a-3f8b1c2",
    "timestamp": "2025-03-05T12:00:00.000Z"
  }
}
```

**Example: face detected but no match**

```json
{
  "humanFace": true,
  "match": false,
  "debug": {
    "status": "no_match",
    "message": "Face detected but did not match",
    "requestId": "m5x2k9a-3f8b1c2",
    "timestamp": "2025-03-05T12:00:00.000Z"
  }
}
```

**Example: no face in image**

```json
{
  "humanFace": false,
  "match": false,
  "debug": {
    "status": "no_face",
    "message": "No face detected in image",
    "requestId": "m5x2k9a-3f8b1c2",
    "timestamp": "2025-03-05T12:00:00.000Z"
  }
}
```

#### Error responses

| Status | Meaning | `debug.message` (typical) |
|--------|---------|----------------------------|
| **400** | Bad request — missing or invalid body fields | `userId is required` or `image (base64) is required` |
| **404** | No registered face for this user in Supabase | `No registered face for user` |
| **405** | Wrong HTTP method | `Method not allowed` (only POST is allowed) |
| **500** | Server error (e.g. detection failure) | Error message or `Internal server error` |
| **502** | Upstream error (e.g. Supabase unreachable or error) | `Failed to fetch registered face` |

Error responses still use the same JSON shape: `humanFace: false`, `match: false`, and `debug` with `status: "error"` and the appropriate `message`.

**Example error (400)**

```json
{
  "humanFace": false,
  "match": false,
  "debug": {
    "status": "error",
    "message": "userId is required",
    "requestId": "m5x2k9a-3f8b1c2",
    "timestamp": "2025-03-05T12:00:00.000Z"
  }
}
```

---

## Match behavior

- **Face detection:** The API uses a single detected face (the first one) from the submitted image. For best results, submit a clear, front-facing face image.
- **Similarity threshold:** A “match” is when the similarity between the submitted face and the registered face is **≥ 0.8** (80%). The threshold is fixed in the API.
- **Registered face:** The reference can be either:
  - A precomputed face embedding stored in your Supabase table, or
  - A face photo URL stored in Supabase; the API fetches the image and computes the embedding once per request.

---

## Limits and constraints

| Item | Limit |
|------|--------|
| Request body size | 10 MB |
| HTTP method | POST only |
| Image format | Decoded from base64 (JPEG, PNG, etc. as supported by the decoder) |

---

## Example usage

**cURL**

```bash
curl -X POST https://human-api-blond.vercel.app/api/v1/recognize \
  -H "Content-Type: application/json" \
  -d '{"userId":"YOUR_USER_ID","image":"BASE64_IMAGE_STRING"}'
```

**JavaScript (fetch)**

```js
const response = await fetch('https://human-api-blond.vercel.app/api/v1/recognize', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    userId: '550e8400-e29b-41d4-a716-446655440000',
    image: base64ImageString,
  }),
});
const data = await response.json();

if (data.humanFace && data.match) {
  console.log('Face verified. Confidence:', data.confidence);
} else if (data.humanFace && !data.match) {
  console.log('Face did not match.');
} else {
  console.log('No face detected or error:', data.debug.message);
}
```

**Next.js (server-side)**

Call from a Server Action or API route so the request never exposes the API URL or body to the client if desired:

```ts
const HUMAN_API = process.env.HUMAN_API_URL ?? 'https://human-api-blond.vercel.app';

export async function verifyFace(userId: string, imageBase64: string) {
  const res = await fetch(`${HUMAN_API}/api/v1/recognize`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, image: imageBase64 }),
  });
  if (!res.ok) throw new Error(`Recognize failed: ${res.status}`);
  return res.json();
}
```

---

## Changelog

| Date       | Description |
|------------|-------------|
| 2025-03-05 | Initial API documentation. |
