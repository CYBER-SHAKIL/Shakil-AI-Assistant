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
- `OPENROUTER_DEFAULT_MODEL=google/gemma-4-31b-it:free`
- `APP_URL=https://shakil-ai-assistant-lime.vercel.app`

The site defaults to `google/gemma-4-31b-it:free`, loads currently available free models from `GET /api/models`, and allows choosing a model in Settings. The server accepts free model IDs ending in `:free` plus `openrouter/free`. Chat requests also configure `openrouter/free` as the fallback route.

## 2. Chat, coding, and image understanding

- `POST /api/chat` — text chat, coding help, streaming responses, and attached-image understanding when the selected model supports image input.
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

## 3. Image generation is separate

The current `POST /api/generate-image` endpoint still uses an OpenAI image-generation API and therefore requires a separate `OPENAI_API_KEY` in Vercel. An OpenRouter key alone does not enable this endpoint. If you only add the OpenRouter key, chat, coding, free-model selection, and supported image understanding can work, but image generation will remain unavailable until its backend is changed to a compatible image provider and configured with that provider's key.

## 4. Security and limitations

- Never put API keys in public HTML or frontend JavaScript.
- The current rate limiter is in-memory and does not persist across Vercel serverless instances.
- Public endpoints can be abused; monitor OpenRouter usage and limits.
- Free model availability, vision support, context limits, and routing behavior may change.

## 5. Assistant modes and safe tool calling

- **Chat mode:** Bengali-first conversation and coding help.
- **Study mode:** step-by-step explanations and examples, selected from the Study chip beside the composer.
- **Image understanding:** attach an image and select a free model marked “Image input”; `openrouter/free` can route to a model supporting image input.
- **Tool calling:** the chat backend exposes a limited arithmetic calculator function. It parses basic arithmetic directly and does not run arbitrary JavaScript, shell commands, or external actions. If a selected model does not support function calling, the backend retries the request without tools.
- **Send button:** green 3D-style button with pressed-state feedback.

## 6. Verification notes

The latest repository inline JavaScript and the `api/chat.js` and `api/models.js` server files passed JavaScript syntax checks. This is a syntax check, not an end-to-end API test. Live chat and model discovery still require `OPENROUTER_API_KEY` to be set in Vercel.
