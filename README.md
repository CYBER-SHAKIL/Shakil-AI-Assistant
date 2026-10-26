# Shakil AI Assistant / Shakil GPT

A static frontend with Vercel serverless backend endpoints for OpenAI text chat and image generation. The assistant is instructed to reply naturally in Bengali and identify Shakil as its creator.

## Features

- Bengali-first AI chat with streamed replies.
- OpenAI Responses API for text.
- OpenAI GPT Image API for image generation.
- Server-side API keys via Vercel Environment Variables.
- Optional personal OpenAI key in Settings (stored in this browser's localStorage and sent to this site's backend when used).
- Model allow-list to prevent arbitrary model strings from being forwarded.
- Basic per-instance request throttling and no-store response headers.
- Chat history and preferences remain in the browser.

## Models

Defaults:
- Chat: `gpt-6.1-sol` — default balanced model.
- Alternative: `gpt-6-luna` — fast everyday chat.
- Alternative: `gpt-6-astra` — for complex reasoning/coding, subject to account access.
- Image: `gpt-image-2.5-flare` — recommended for fast, high-quality everyday image generation.
- Image alternative: `gpt-image-2.5-sunburst` — consider for image edits/precision-focused work.

Availability, pricing, rate limits, and organization verification depend on the OpenAI account. API use may cost money; an API key does not automatically mean free usage.

## Deploy to Vercel

1. Revoke any API key that was posted in a chat, screenshot, public repository, or browser code. Create a fresh key.
2. Open Vercel → select `shakil-ai-assistant` → Settings → Environment Variables.
3. Add `OPENAI_API_KEY` with the new OpenAI API key. Select Production (and Preview/Development only if needed).
4. Optional variables:
   - `OPENAI_CHAT_MODEL` — default `gpt-6.1-sol`
   - `OPENAI_IMAGE_MODEL` — default `gpt-image-2.5-flare`
5. Save, then redeploy the latest deployment so the environment variables take effect.
6. Test the site with one Bengali chat question, then test Image Mode.

Never put `OPENAI_API_KEY` in `index.html`, frontend JavaScript, a committed `.env` file, or GitHub. The backend reads it only from the server environment.

## Backend endpoints

### `POST /api/chat`

Request:
```json
{
  "model": "gpt-6.1-sol",
  "stream": true,
  "messages": [
    { "role": "user", "content": "তোমাকে কে তৈরি করেছে?" }
  ]
}
```

The frontend uses streaming. The endpoint calls `POST https://api.openai.com/v1/responses` and translates text-delta events into a Chat Completions-style SSE stream for the existing UI. For `stream: false`, it returns `{ "reply": "..." }`.

Allowed chat models: `gpt-6-luna`, `gpt-6.1-sol`, `gpt-6-astra`.

### `POST /api/generate-image`

Request:
```json
{
  "prompt": "বাংলার নদীর ধারে সূর্যাস্তের একটি cinematic ছবি",
  "model": "gpt-image-2.5-flare"
}
```

Returns:
```json
{
  "imageBase64": "...",
  "mimeType": "image/png",
  "caption": "তোমার তৈরি করা ছবি"
}
```

Allowed image models: `gpt-image-2.5-flare`, `gpt-image-2.5-sunburst`, `gpt-image-2`.

### Use your own OpenAI key from another bot

A trusted server-side client can send its own key as `Authorization: Bearer YOUR_OPENAI_API_KEY` when calling these endpoints. The backend forwards that key for that request. Do not put a private key in another website's browser/frontend. Do not use the site owner's key without explicit permission.

Example:
```bash
curl https://shakil-ai-assistant-lime.vercel.app/api/chat \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_OWN_OPENAI_API_KEY" \
  -d '{"model":"gpt-6-luna","stream":false,"messages":[{"role":"user","content":"বাংলায় AI কী বুঝিয়ে বলো"}]}'
```

## Important security and production notes

- The public website can call the backend without supplying a key, so it uses the server key. This means anyone can attempt to use your server quota. Basic in-memory throttling is only a small guardrail and may reset between serverless instances.
- Before promoting this as a public API for other people/bots, add real authentication, persistent per-user quotas/rate limits, abuse monitoring, and an API-key issuance/revocation system backed by a database. Do not publish a server key.
- The current optional user key is stored in localStorage in that browser; clear it from Settings when finished, especially on shared devices.
- Image generation can take longer and costs more than a text request. Errors may indicate missing billing, model access, or organization verification.
- No API can guarantee every answer is correct or perfectly human-like. The system prompt encourages natural Bengali responses but does not guarantee factual accuracy.
- This project currently does not include a database-backed user account system or a secure API-key management dashboard.
