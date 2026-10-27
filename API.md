# Shakil AI Assistant — API Setup

The chat backend uses **OpenRouter**. The OpenRouter key must stay on Vercel and must never be added to `index.html`, browser storage, or GitHub.

## 1. Add the OpenRouter key in Vercel

1. Open the [Vercel project](https://vercel.com/cyber-shakils-projects/shakil-ai-assistant).
2. Go to **Settings → Environment Variables**.
3. Add:
   - **Key:** `OPENROUTER_API_KEY`
   - **Value:** your OpenRouter API key (starts with `sk-or-v1-`)
   - **Environments:** Production, Preview, and Development.
4. Save the variable, then go to **Deployments** and redeploy the latest production deployment (or push a new commit).

Do not send your key in chat or commit it to GitHub.

Optional:
- `TAVILY_API_KEY` — server-only Tavily Search API key. Without it, live search is unavailable but ordinary chat continues.
- `WEB_SEARCH_DAILY_GLOBAL_LIMIT=1000` — optional deployment-wide daily search cap (shared when Upstash Redis is configured).
- `WEB_SEARCH_DAILY_IP_LIMIT=20` — optional per-IP daily search cap.
- `WEB_SEARCH_DAILY_KEY_LIMIT=100` — optional per-project-API-key daily search cap.
- `OPENROUTER_DEFAULT_MODEL=google/gemma-4-31b-it:free`
- `APP_URL=https://shakil-ai-assistant-lime.vercel.app`

The site defaults to `google/gemma-4-31b-it:free`, loads currently available free models from `GET /api/models`, and allows choosing a model in Settings. The server accepts free model IDs ending in `:free` plus `openrouter/free`. Chat requests also configure `openrouter/free` as the fallback route.

## 2. Chat, coding, and image understanding

- `POST /api/chat` — text chat, coding help, streaming responses, calculator calls, optional Tavily web search, and attached-image understanding when the selected model supports image input.
- `GET /api/models` — retrieves the currently available free OpenRouter models and their image-input capability.

Example request:

```json
{
  "model": "google/gemma-4-31b-it:free",
  "stream": true,
  "messages": [
    { "role": "user", "content": "তোমার developer কে?" }
  ]
}
```

The browser sends attached images as multimodal `image_url` content to `/api/chat`. Choose a model marked as supporting image input for image questions. Availability and free limits can change on OpenRouter.

When configured, the backend can call Tavily for current or changing information. Search is optional and uses the server-side `TAVILY_API_KEY`; the key is never sent to the browser. Results are limited to five short title/URL/snippet entries, search usage is capped per IP and project API key, and the model is instructed to treat search snippets as untrusted content and cite useful URLs in a `সূত্র:` section. The backend allows at most two tool rounds per chat request. If Tavily is not configured, normal chat continues and the assistant is told live search is unavailable.

## 3. Image generation with Cloudflare Workers AI

Image generation uses Cloudflare Workers AI model `@cf/black-forest-labs/flux-1-schnell` through `POST /api/generate-image`. Bengali prompts are optionally enhanced into a detailed English prompt with the server-side OpenRouter key. The browser never receives either provider key.

Add these server-only variables in Vercel → Settings → Environment Variables:
- `CLOUDFLARE_ACCOUNT_ID` — your Cloudflare account ID.
- `CLOUDFLARE_API_TOKEN` — a Cloudflare API token with Workers AI permission.
- `OPENROUTER_API_KEY` — also used for text chat and prompt enhancement.

Redeploy after saving environment variables. Cloudflare Workers AI usage and limits depend on your Cloudflare account; do not assume unlimited free generation.

Use an explicit command such as `/image বাংলার নদীর ধারে সূর্যাস্ত, cinematic lighting` to generate an image. HTML, SVG, and code requests remain normal chat requests. Image-to-image generation using an uploaded reference image is not supported yet; remove attachments when using `/image`.

## 4. Security and limitations

- Never put API keys in public HTML or frontend JavaScript.
- Rate limits use Upstash Redis when `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` are configured; otherwise the fallback is per-instance in-memory and is not globally persistent.
- Public endpoints can be abused; monitor OpenRouter usage and limits.
- Free model availability, vision support, context limits, and routing behavior may change.

## 5. Assistant modes and safe tool calling

- **Chat mode:** Bengali-first conversation and coding help.
- **Study mode:** step-by-step explanations and examples, selected from the Study chip beside the composer.
- **Image understanding:** attach an image and select a free model marked “Image input”; `openrouter/free` can route to a model supporting image input.
- **Tool calling:** the chat backend exposes a limited arithmetic calculator and optional Tavily `web_search` function. It parses basic arithmetic directly and does not run arbitrary JavaScript, shell commands, or external actions. If a selected model does not support function calling, the backend retries the request without tools.
- **Send button:** green 3D-style button with pressed-state feedback.

## 6. Verification notes

The latest repository inline JavaScript and the `api/chat.js` and `api/models.js` server files passed JavaScript syntax checks. This is a syntax check, not an end-to-end API test. Live chat and model discovery still require `OPENROUTER_API_KEY` to be set in Vercel.


## Firebase-backed project API keys

The Settings panel includes a project API key manager. It is intentionally disabled until these server-only Vercel environment variables are configured:

- `FIREBASE_SERVICE_ACCOUNT_JSON`: the **newly rotated** Firebase service-account JSON, pasted as one JSON value in Vercel only.
- `FIREBASE_DATABASE_URL`: `https://shakil-dev-pro-default-rtdb.asia-southeast1.firebasedatabase.app`
- `API_KEY_ADMIN_SECRET`: a long, random admin secret used only to create, list, and revoke project API keys.
- `OPENROUTER_API_KEY`: the server-side OpenRouter key already required for chat.

**Important:** the service-account private key shared in chat is compromised. Revoke it in Google Cloud Console and create a new key before setting `FIREBASE_SERVICE_ACCOUNT_JSON`. Never put the service-account JSON or admin secret in this repository or the browser. The public Firebase web config is not a replacement for the service-account credential.

In Settings, enter the admin secret and create a project key. The raw key is shown only once; copy it securely. The database stores a SHA-256 hash and metadata, not the raw key. Revoke a key in Settings to disable it.

External project requests use the same chat endpoint:

```bash
curl https://shakil-ai-assistant-lime.vercel.app/api/chat \
  -H "Content-Type: application/json" \
  -H "x-shakil-api-key: sk-shakil-YOUR_KEY" \
  -d '{"model":"openrouter/free","stream":false,"messages":[{"role":"user","content":"বাংলায় একটি HTML উদাহরণ দাও"}]}'
```

The response is JSON when `stream` is false. Set `stream` to true for server-sent events. For image generation, POST to `/api/generate-image` with `x-shakil-api-key` and JSON like `{"prompt":"A sunset over a river"}`. The server uses Cloudflare Workers AI; no image model selector is sent from the browser. Keep project keys on the server side of your own apps; do not ship them in public browser JavaScript.
