# Shakil AI Assistant

A Bengali-first AI chat app with a static `index.html` frontend and Vercel serverless API routes.

## Features

- Bengali-first chat and coding help with streamed responses.
- OpenRouter chat models, including the `openrouter/free` routing option.
- Image understanding when the selected chat model supports vision.
- Image generation through Cloudflare Workers AI using `@cf/black-forest-labs/flux-1-schnell`.
- IndexedDB storage for conversations and image blobs, with migration from the older localStorage conversation key.
- Client-side image resizing/compression before upload.
- Server-side provider credentials; no provider secrets belong in frontend code.
- Firebase-backed project API key management when its server environment variables are configured.

## Environment variables

Configure these in Vercel → Project → Settings → Environment Variables, then redeploy.

Required for chat:
- `OPENROUTER_API_KEY` — server-side OpenRouter key.

Required for image generation:
- `CLOUDFLARE_ACCOUNT_ID` — Cloudflare account ID.
- `CLOUDFLARE_API_TOKEN` — Cloudflare API token permitted to use Workers AI.
- `OPENROUTER_API_KEY` — also used to enhance image prompts.

Recommended:
- `OPENROUTER_DEFAULT_MODEL=google/gemma-4-31b-it:free`
- `APP_URL=https://shakil-ai-assistant.vercel.app`
- `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` for persistent rate limiting.
- `FIREBASE_SERVICE_ACCOUNT_JSON`, `FIREBASE_DATABASE_URL`, and `API_KEY_ADMIN_SECRET` for project API key management.
- `TURNSTILE_SECRET_KEY` if Turnstile verification is enabled.

Never commit secrets, place them in `index.html`, or paste them into a public chat.

## Image generation

Use an explicit command in chat:

```text
/image বাংলার নদীর ধারে সূর্যাস্ত, cinematic lighting
```

The app only enters image-generation mode for the explicit `/image` command or the Create an image suggestion. Ordinary requests for HTML, SVG, or code stay in chat mode. Image-to-image generation from uploaded reference images is not supported yet.

Cloudflare's FLUX.1 schnell endpoint returns base64 image data; the API route responds with `imageBase64`, `mimeType`, and `caption`. See [Cloudflare model documentation](https://developers.cloudflare.com/workers-ai/models/flux-1-schnell/).

## API endpoints

- `POST /api/chat` — OpenRouter chat and streaming.
- `GET /api/models` — available free chat models.
- `POST /api/generate-image` — Cloudflare Workers AI image generation.
- `POST /api/keys` — Firebase-backed project API key management.

Image generation and provider APIs may have usage limits or costs depending on the provider account. Do not assume a service is unlimited or always free.

## Deployment and testing

Commits to the connected `main` branch trigger Vercel deployments. Check the deployment state in Vercel after each commit. A deployment marked `READY` does not by itself prove that every live API call works.

Recommended smoke tests:
1. Send a Bengali chat question.
2. Try a code/HTML request and verify it remains in chat mode.
3. Send `/image a simple landscape at sunset` after adding Cloudflare environment variables.
4. Attach an image to a normal question and test image understanding with a vision-capable model.
5. Test Stop, history persistence, JSON export/import, and the Settings storage usage display.
