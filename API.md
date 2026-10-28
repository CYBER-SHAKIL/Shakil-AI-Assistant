# Shakil AI Assistant — API Guide

Base URL: use your current Vercel deployment URL, for example `https://YOUR-PROJECT.vercel.app`. Do not assume a sample hostname is your live production URL.

## 1. API key lifecycle

### Required server environment

Configure these in Vercel → Project → **Settings → Environment Variables**:

- `FIREBASE_SERVICE_ACCOUNT_JSON`: service-account JSON containing `client_email` and `private_key`.
- `FIREBASE_DATABASE_URL`: Firebase Realtime Database URL (a `.firebasedatabase.app` or `.firebaseio.com` URL).
- `API_KEY_ADMIN_SECRET`: a strong secret used only by the key-management endpoint.

Select each environment where you need this functionality (Production, Preview, Development). After changing variables, redeploy that environment. Do not paste secrets into chat, commit them, or place them in browser code.

### Create a key

Send this request from a trusted terminal or server-side admin tool. The admin secret is shown as an environment variable, not hard-coded into source:

```bash
export API_BASE_URL="https://YOUR-PROJECT.vercel.app"
read -s API_KEY_ADMIN_SECRET
export API_KEY_ADMIN_SECRET
curl -sS "$API_BASE_URL/api/keys" \
  -H "Content-Type: application/json" \
  -d "{\"adminSecret\":\"$API_KEY_ADMIN_SECRET\",\"action\":\"create\",\"label\":\"My project\"}"
```

A successful response is similar to:

```json
{
  "key": "sk-shakil-ONE_TIME_VALUE",
  "record": {
    "label": "My project",
    "prefix": "sk-shakil-...",
    "createdAt": "2026-01-01T00:00:00.000Z",
    "revoked": false
  },
  "warning": "Copy this key now. It will not be shown again."
}
```

The key value above is illustrative, not a working credential. Copy the actual `key` field into the secret manager for the project that will use it. The raw key is returned only once; it cannot be retrieved through list. This repository intentionally does not provide a browser admin form, because the admin secret must not be exposed to browser JavaScript. A copy button is not provided by the JSON API; use your trusted API client's copy feature or your terminal/secret manager.

### List key metadata

```bash
curl -sS "$API_BASE_URL/api/keys" \
  -H "Content-Type: application/json" \
  -d "{\"adminSecret\":\"$API_KEY_ADMIN_SECRET\",\"action\":\"list\"}"
```

The response includes a `keys` array with record IDs, labels, prefixes, timestamps, and revoked state. It never includes raw keys.

### Revoke a key

Use the record `id` returned by list:

```bash
curl -sS "$API_BASE_URL/api/keys" \
  -H "Content-Type: application/json" \
  -d "{\"adminSecret\":\"$API_KEY_ADMIN_SECRET\",\"action\":\"revoke\",\"id\":\"64_CHARACTER_HEX_RECORD_ID\"}"
```

Success: `{"ok":true}`. Revoke a compromised key immediately, remove it from the dependent project's secret store, and issue a new key if needed. Revoked keys must not authenticate.

Key manager errors include `400` for invalid action/ID, `401` for incorrect admin secret, `404` for unknown key ID, `405` for a non-POST method, `429` for too many attempts, and `503` for missing/broken Firebase or admin configuration.

## 2. Calling the external chat API

Store the issued key in the other project's server environment as `SHAKIL_API_KEY`. Do not place it in frontend JavaScript, browser storage, public repositories, or client-side requests.

Example Node.js server code:

```js
const response = await fetch(`${process.env.SHAKIL_API_BASE_URL}/api/chat`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${process.env.SHAKIL_API_KEY}`
  },
  body: JSON.stringify({
    model: "openrouter/free",
    stream: false,
    messages: [{ role: "user", content: "বাংলায় একটি HTML উদাহরণ দাও" }]
  })
});

const data = await response.json();
if (!response.ok) {
  throw new Error(`Shakil API error ${response.status}: ${data.error || "Request failed"}`);
}
console.log(data.reply);
```

Set `SHAKIL_API_BASE_URL` to your deployed Shakil API base URL and `SHAKIL_API_KEY` to the issued key in your hosting provider's server-side environment settings. The code above runs on a server, not in a browser.

Request body:

- `model`: `openrouter/free` or an available free model ID ending in `:free`; defaults to Auto if omitted.
- `stream`: `false`/omitted returns JSON; `true` returns Server-Sent Events (SSE).
- `messages`: a non-empty array of `user` and `assistant` messages. Do not send a `system` role.
- Up to 30 recent messages are processed. Each text message is limited to 12,000 characters.
- Image analysis may be requested using supported base64 `data:image/...` parts in message content; the selected model must support image input.

Success (`stream: false`):

```json
{ "reply": "এখানে AI-এর উত্তর", "model": "openrouter/free" }
```

With `stream: true`, the content type is `text/event-stream`; parse the SSE chunks and stop at `data: [DONE]`.

## 3. Calling the external image-generation API

```js
const response = await fetch(`${process.env.SHAKIL_API_BASE_URL}/api/generate-image`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${process.env.SHAKIL_API_KEY}`
  },
  body: JSON.stringify({
    prompt: "A peaceful river in Bangladesh at sunset, cinematic lighting"
  })
});
const data = await response.json();
if (!response.ok) {
  throw new Error(`Shakil image API error ${response.status}: ${data.error || "Request failed"}`);
}
// data.imageBase64 contains the generated image.
```

Request format: `{"prompt":"..."}`; prompt is required and limited to 1,000 characters. Reference-image image-to-image generation is not supported currently.

Success response:

```json
{
  "imageBase64": "BASE64_IMAGE_DATA",
  "mimeType": "image/jpeg",
  "caption": "তোমার তৈরি করা ছবি"
}
```

Image generation requires the server-side `CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_API_TOKEN` variables. OpenRouter may be used to improve some non-ASCII prompts, but it is not the image provider.

## 4. Model discovery

`GET /api/models` is public because the website's model selector uses it. It returns the current free-model list from OpenRouter and does not return provider secrets.

Example:

```json
{
  "models": [
    { "id": "openrouter/free", "name": "OpenRouter Free Router", "vision": true, "contextLength": null }
  ]
}
```

The model list changes with provider availability; this is only an example. `OPENROUTER_API_KEY` must be configured on the server.

## 5. Public website routes versus authenticated API routes

The website uses `POST /api/public/chat` and `POST /api/public/generate-image` to preserve its public user experience. These routes do not require a Shakil API key; they use the public flow and rate limits, and enforce Turnstile if `TURNSTILE_SECRET_KEY` is configured.

External projects must use `/api/chat` and `/api/generate-image`. Those routes reject missing, malformed, invalid, and revoked Shakil keys with `401`. If Firebase cannot be reached or is misconfigured, key verification fails closed with `503` rather than accepting the key.

## 6. Environment variables

| Variable | Purpose |
| --- | --- |
| `FIREBASE_SERVICE_ACCOUNT_JSON` | Firebase service account for key storage/verification |
| `FIREBASE_DATABASE_URL` | Firebase Realtime Database URL |
| `API_KEY_ADMIN_SECRET` | Key-management admin secret |
| `OPENROUTER_API_KEY` | Chat and model discovery provider credential |
| `CLOUDFLARE_ACCOUNT_ID` | Image-generation account |
| `CLOUDFLARE_API_TOKEN` | Workers AI token |
| `APP_URL` | Website origin/CORS |
| `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` | Recommended persistent rate limiting |
| `TURNSTILE_SECRET_KEY` | Optional Turnstile verification for public website routes |
| `TAVILY_API_KEY` | Optional web search |

Optional limits: `CHAT_RATE_LIMIT_PER_MINUTE` (20), `API_KEY_DAILY_CHAT_LIMIT` (500), `IMAGE_DAILY_LIMIT_PER_IP` (5), `IMAGE_DAILY_LIMIT_PER_KEY` (20), `IMAGE_GLOBAL_DAILY_LIMIT` (100), `WEB_SEARCH_DAILY_GLOBAL_LIMIT` (1000), `WEB_SEARCH_DAILY_IP_LIMIT` (20), `WEB_SEARCH_DAILY_KEY_LIMIT` (100).

## 7. HTTP errors and troubleshooting

- `400`: malformed JSON, invalid action, invalid key ID, or invalid request fields.
- `401`: missing/invalid/revoked Shakil key on external chat/image endpoints, or wrong admin secret.
- `403`: configured Turnstile verification failed on public website routes.
- `404`: API key record not found during revoke.
- `405`: unsupported HTTP method.
- `413`: request body too large.
- `429`: rate/quota limit exceeded.
- `502`: upstream provider or model-list failure.
- `503`: missing provider credentials, missing Firebase/admin configuration, or Firebase verification temporarily unavailable.

Firebase setup failures: confirm the service-account JSON is valid and includes `client_email` and `private_key`, check the exact `FIREBASE_DATABASE_URL`, verify service-account access to the database, and redeploy after variable changes. Never share the values themselves.

Provider secrets are separate from issued Shakil keys. A valid Shakil key does not replace `OPENROUTER_API_KEY` or `CLOUDFLARE_API_TOKEN`; those remain server-side configuration. A successful deploy does not prove the provider or Firebase is reachable, so test the actual endpoints after deployment.
