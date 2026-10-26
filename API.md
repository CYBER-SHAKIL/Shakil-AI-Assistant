# Shakil GPT API

These endpoints are deployed as Vercel Functions.

## Vercel environment variables

Set `OPENROUTER_API_KEY` in Vercel → Project → Settings → Environment Variables. Use a fresh OpenRouter key. Never commit a provider key to GitHub. Optionally set `OPENROUTER_CHAT_MODEL` (default `openai/gpt-4o-mini`), `OPENROUTER_IMAGE_CHAT_MODEL` (default `openai/gpt-4o-mini`), and `APP_URL`.

## Chat API

`POST /api/chat`

```json
{
  "messages": [
    { "role": "user", "content": "তোমার নির্মাতা কে?" }
  ],
  "stream": false,
  "model": "openai/gpt-4o-mini"
}
```

Returns an OpenAI-compatible chat-completion response when `stream:false`; supports SSE when `stream:true`. The assistant is instructed to answer primarily in Bengali and identify Shakil as its creator/owner.

## Image API

`POST /api/generate-image`

```json
{
  "prompt": "বাংলার নদীর ধারে সূর্যাস্তের একটি জলরঙের ছবি",
  "model": "openai/gpt-4o-mini"
}
```

Returns `{ "imageUrl": "...", "caption": "..." }`. Image generation uses OpenRouter's `openrouter:image_generation` server tool; the selected chat model must support the tool and the account must have provider credits.

## Using your own provider key

For personal development or a separate bot, send your own OpenRouter key in the request header `Authorization: Bearer YOUR_OWN_OPENROUTER_KEY`. The server forwards that key to OpenRouter for that request. Do not put the site owner's key in another website's frontend. The UI's optional key setting is saved only in that browser's local storage, but it is sent to this site's backend when used.

## Important

The API endpoints are publicly reachable and the server key is used when no Authorization header is supplied. The basic per-instance IP rate limits are only a small guardrail, not production-grade abuse protection; add persistent rate limiting/authentication and usage caps before sharing the server-key-backed API publicly. OpenRouter and Vercel usage may cost money.
