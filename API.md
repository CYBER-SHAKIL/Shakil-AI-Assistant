# Shakil GPT API / Backend Guide

This repository uses the official OpenAI API, not OpenRouter.

## 1. Vercel environment

Required:
- `OPENAI_API_KEY`: a fresh OpenAI API key stored only in Vercel Environment Variables.

Optional:
- `OPENAI_CHAT_MODEL=gpt-6-luna`
- `OPENAI_IMAGE_MODEL=gpt-image-2.5-flare`

After changing environment variables, redeploy the project. Never commit secrets to GitHub. Revoke keys exposed in chats or source code.

## 2. Chat

`POST /api/chat`

```json
{
  "model": "gpt-6-luna",
  "stream": false,
  "messages": [
    { "role": "user", "content": "তোমার নির্মাতা কে?" }
  ]
}
```

Non-streaming response: `{ "reply": "...", "id": "...", "model": "..." }`.
The website uses `stream: true` for live text output.

Models allowed: `gpt-6-luna`, `gpt-6.1-sol`, `gpt-6-astra`.

## 3. Image generation

`POST /api/generate-image`

```json
{
  "prompt": "A cinematic sunset over a river in Bangladesh",
  "model": "gpt-image-2.5-flare"
}
```

Returns `imageBase64`, `mimeType`, and `caption`. Models allowed: `gpt-image-2.5-flare`, `gpt-image-2.5-sunburst`, `gpt-image-2`.

## 4. Calling from another server

A bot backend may send its own OpenAI API key in `Authorization: Bearer YOUR_OWN_OPENAI_API_KEY`. Never embed a private key in browser JavaScript or public HTML. The endpoint can otherwise fall back to the website's configured server key, which creates abuse and billing risk if the endpoint is shared publicly.

## 5. Current limitations / production hardening

- The current per-IP limiter is in-memory and not persistent across serverless instances.
- No database-backed user login, API key creation/revocation, per-user quota, or billing system is included yet.
- Add persistent rate limiting, authentication, usage tracking, and abuse monitoring before publishing a public third-party API.
- OpenAI API usage may be billed separately from ChatGPT subscriptions; confirm model access and billing in the OpenAI Platform.
