# Shakil AI Assistant — API নির্দেশিকা

এই ডকুমেন্টে Vercel serverless API-এর route, request format, authentication, response ও troubleshooting দেওয়া হলো। Production base URL: `https://shakil-ai-assistant-lime.vercel.app`। নিজের বর্তমান Vercel production domain ভিন্ন হলে সেটি ব্যবহার করো।

## সাধারণ নিয়ম

- JSON request-এর জন্য `Content-Type: application/json` পাঠাও।
- Provider secret (`OPENROUTER_API_KEY`, Cloudflare token, Tavily key, Firebase service-account JSON) browser থেকে পাঠানোর দরকার নেই এবং এগুলো কখনো public client-এ রেখো না।
- Project API key থাকলে `x-shakil-api-key: sk-shakil-...` header অথবা `Authorization: Bearer sk-shakil-...` ব্যবহার করো।
- Project API key না দিলে public chat/image endpoint-এর request Turnstile check-এর মধ্য দিয়ে যেতে পারে। `TURNSTILE_SECRET_KEY` সেট না থাকলে server verification সক্রিয় থাকে না।
- JSON error response সাধারণত `{ "error": "..." }` ফরম্যাটে আসে।
- Body ভুল JSON হলে `400`; body limit ছাড়ালে `413`; rate limit ছাড়ালে `429` হতে পারে।

## 1. `POST /api/chat`

Text chat, code help, streamed output, সীমিত arithmetic calculator এবং `TAVILY_API_KEY` থাকলে web search।

### Request body

```json
{
  "model": "openrouter/free",
  "stream": false,
  "messages": [
    { "role": "user", "content": "বাংলায় একটি HTML উদাহরণ দাও" }
  ]
}
```

- `model`: `openrouter/free` অথবা `:free` দিয়ে শেষ হওয়া free model ID। বাদ দিলে Auto route ব্যবহার হয়।
- `stream`: `false` বা বাদ দিলে JSON response; `true` দিলে Server-Sent Events (SSE)।
- `messages`: non-empty array; শুধু `user` ও `assistant` role অনুমোদিত। `system` role পাঠানো যাবে না।
- সর্বশেষ 30টি message process করা হয়। একটি text message সর্বোচ্চ 12,000 অক্ষর।
- Image input-এর জন্য `content` একটি text/image part array হতে পারে; image URL অবশ্যই base64 `data:image/png`, `jpeg`, `webp` বা `gif` URL হতে হবে। সব image মিলে সর্বোচ্চ 2.5 MB। নির্বাচিত model-কে image input সমর্থন করতে হবে।

### JSON response (stream=false)

```json
{
  "reply": "এখানে AI-এর উত্তর",
  "model": "ব্যবহৃত model ID"
}
```

সাধারণ greeting-এর জন্য backend `model: "greeting"`-সহ JSON দিতে পারে।

### Streaming response (stream=true)

Response content type `text/event-stream`। প্রতিটি event-এর data-তে OpenAI-style chunk থাকে, যেমন:

```text
data: {"choices":[{"delta":{"content":"হ্যালো"}}]}

data: [DONE]
```

Client-কে SSE event পড়তে হবে এবং `data: [DONE]` এলে stream শেষ করতে হবে। Stream শুরু হওয়ার পর upstream error হলে HTTP status ইতিমধ্যে 200 হয়ে থাকতে পারে; তাই client-কে stream-এর error event/শেষ হওয়া যাচাই করতে হবে।

### Rate limit ও error

- Default: প্রতি IP-তে 20 request/minute (`CHAT_RATE_LIMIT_PER_MINUTE`)।
- Project API key ব্যবহার করলে default 500 chat request/day (`API_KEY_DAILY_CHAT_LIMIT`)।
- Invalid/revoked key: `401`।
- Turnstile configured থাকলে verification failure: `403`।
- Rate limit: `429`।
- OpenRouter key অনুপস্থিত: `503`।
- Model/provider failure: upstream failure অনুযায়ী error হতে পারে; fallback model চেষ্টা করা হয়।

## 2. `GET /api/models`

OpenRouter থেকে পাওয়া free chat model তালিকা এবং vision capability দেয়। এই route-এর জন্য server-side `OPENROUTER_API_KEY` প্রয়োজন।

Example:

```json
{
  "models": [
    {
      "id": "openrouter/free",
      "name": "OpenRouter Free Router",
      "vision": true,
      "contextLength": null
    }
  ]
}
```

প্রতিটি model object-এ `id`, `name`, `vision`, `contextLength` থাকতে পারে। প্রকৃত তালিকা OpenRouter-এর availability অনুসারে পরিবর্তিত হয়; উপরের object কেবল format-এর উদাহরণ। Cache header প্রায় 5 মিনিটের জন্য response cache করতে পারে।

- `405`: GET ছাড়া অন্য method।
- `503`: `OPENROUTER_API_KEY` configure করা নেই।
- `502`: upstream model list পাওয়া যায়নি।

## 3. `POST /api/generate-image`

Cloudflare Workers AI model `@cf/black-forest-labs/flux-1-schnell` দিয়ে text-to-image generation।

### Request

```json
{
  "prompt": "A peaceful river in Bangladesh at sunset, cinematic lighting"
}
```

- `prompt` আবশ্যক; সর্বোচ্চ 1,000 অক্ষর।
- `referenceImages` দিয়ে image-to-image generation এখনো সমর্থিত নয়; পাঠালে `400` আসবে।
- প্রয়োজনীয় server variables: `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_API_TOKEN`। `OPENROUTER_API_KEY` থাকলে non-ASCII prompt-এর enhancement চেষ্টা করা হয়; enhancement ব্যর্থ হলে মূল prompt ব্যবহার হয়।

### সফল response

```json
{
  "imageBase64": "BASE64_IMAGE_DATA",
  "mimeType": "image/jpeg",
  "caption": "তোমার তৈরি করা ছবি"
}
```

Client-কে `imageBase64` ও `mimeType` দিয়ে image দেখাতে হবে।

### Limit

- প্রতি IP-তে default 5 image/day: `IMAGE_DAILY_LIMIT_PER_IP`
- প্রতি project API key-তে default 20 image/day: `IMAGE_DAILY_LIMIT_PER_KEY`
- সব request মিলিয়ে default 100 image/day: `IMAGE_GLOBAL_DAILY_LIMIT`

Configuration অনুপস্থিত হলে `503`; provider response failure বা connection failure হলে সাধারণত `502`; limit ছাড়ালে `429`।

## 4. `POST /api/keys`

Firebase Realtime Database-এ project API key তৈরি, তালিকা দেখা এবং revoke করা। এই route ব্যবহার করতে `FIREBASE_SERVICE_ACCOUNT_JSON`, `FIREBASE_DATABASE_URL` এবং `API_KEY_ADMIN_SECRET` configure করতে হবে।

**Request-এ `adminSecret` পাঠানো হয়। এটি private admin secret—কখনো frontend source, public repository বা public chat-এ রেখো না।**

### Create

```json
{
  "adminSecret": "YOUR_PRIVATE_ADMIN_SECRET",
  "action": "create",
  "label": "My project"
}
```

সফল response-এ `key`, `record`, `warning` থাকে। Raw key একবারই দেখানো হয়; সঙ্গে সঙ্গে নিরাপদ জায়গায় কপি করো। Database-এ raw key নয়, SHA-256 hash ও metadata রাখা হয়।

### List

```json
{
  "adminSecret": "YOUR_PRIVATE_ADMIN_SECRET",
  "action": "list"
}
```

Response-এ `keys` array থাকে। তালিকায় key metadata ও record ID থাকে, raw key নয়।

### Revoke

```json
{
  "adminSecret": "YOUR_PRIVATE_ADMIN_SECRET",
  "action": "revoke",
  "id": "64-character-lowercase-hex-record-id"
}
```

সফল হলে `{ "ok": true }` ফেরত আসে। Revoke করার পর key আর valid হওয়া উচিত নয়।

- শুধু POST অনুমোদিত; অন্য method-এ `405`।
- ভুল admin secret: `401`।
- 10 মিনিটে IP-প্রতি 10 ভুল/অতিরিক্ত attempt-এর পরে `429`।
- Firebase/env সমস্যা হলে `503`।

## 5. Environment variables

Vercel → Project → Settings → Environment Variables-এ server-side values যোগ করে redeploy করো।

| Variable | কোন কাজে লাগে |
| --- | --- |
| `OPENROUTER_API_KEY` | Chat ও model discovery; optional prompt enhancement |
| `APP_URL` | Canonical app origin ও CORS |
| `CLOUDFLARE_ACCOUNT_ID` | Image generation |
| `CLOUDFLARE_API_TOKEN` | Workers AI access |
| `TAVILY_API_KEY` | Optional live web search |
| `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` | Persistent rate limiting |
| `TURNSTILE_SECRET_KEY` | Optional server-side Turnstile verification |
| `FIREBASE_SERVICE_ACCOUNT_JSON`, `FIREBASE_DATABASE_URL` | Firebase-backed project key manager |
| `API_KEY_ADMIN_SECRET` | Project key manager admin authorization |

Optional limits: `CHAT_RATE_LIMIT_PER_MINUTE` (20), `API_KEY_DAILY_CHAT_LIMIT` (500), `IMAGE_DAILY_LIMIT_PER_IP` (5), `IMAGE_DAILY_LIMIT_PER_KEY` (20), `IMAGE_GLOBAL_DAILY_LIMIT` (100), `WEB_SEARCH_DAILY_GLOBAL_LIMIT` (1000), `WEB_SEARCH_DAILY_IP_LIMIT` (20), `WEB_SEARCH_DAILY_KEY_LIMIT` (100)। প্রতিটি value code-এর default override করে।

## 6. cURL উদাহরণ

Non-stream chat:

```bash
curl https://shakil-ai-assistant-lime.vercel.app/api/chat \
  -H "Content-Type: application/json" \
  -d '{"model":"openrouter/free","stream":false,"messages":[{"role":"user","content":"হ্যালো"}]}'
```

Project API key দিয়ে chat:

```bash
curl https://shakil-ai-assistant-lime.vercel.app/api/chat \
  -H "Content-Type: application/json" \
  -H "x-shakil-api-key: sk-shakil-YOUR_KEY" \
  -d '{"model":"openrouter/free","stream":false,"messages":[{"role":"user","content":"বাংলায় উত্তর দাও"}]}'
```

Image generation:

```bash
curl https://shakil-ai-assistant-lime.vercel.app/api/generate-image \
  -H "Content-Type: application/json" \
  -d '{"prompt":"A simple landscape at sunset"}'
```

Public endpoints-এর request limit এবং provider-এর account limits প্রযোজ্য। নিজের project key তৈরি করে ব্যবহার করলে request-এ সেটি header হিসেবে পাঠাও।

## 7. Troubleshooting

- **Chat-এ 503:** Vercel-এ `OPENROUTER_API_KEY` আছে কি না এবং সঠিক environment (Production/Preview/Development) নির্বাচন করা হয়েছে কি না দেখো; তারপর redeploy করো।
- **Model list empty/502:** OpenRouter key ও upstream service পরীক্ষা করো। Free model availability পরিবর্তিত হতে পারে।
- **Image generation 503:** `CLOUDFLARE_ACCOUNT_ID` ও `CLOUDFLARE_API_TOKEN` আছে কি না দেখো।
- **Image generation 502:** Cloudflare Workers AI permission, account usage/limits এবং token status পরীক্ষা করো।
- **401 invalid project key:** key revoke হয়েছে কি না, header format ঠিক কি না এবং Firebase configuration সচল কি না দেখো।
- **API key manager 503:** নতুন/valid `FIREBASE_SERVICE_ACCOUNT_JSON`, সঠিক `FIREBASE_DATABASE_URL`, এবং `API_KEY_ADMIN_SECRET` configure করে redeploy করো।
- **429:** দৈনিক বা মিনিটভিত্তিক limit শেষ; সময়/limit reset না হওয়া পর্যন্ত অপেক্ষা করো।
- **Rate limit persistent নয়:** `UPSTASH_REDIS_REST_URL` ও `UPSTASH_REDIS_REST_TOKEN` configure করো।
- **CORS:** browser request-এর origin `APP_URL`-এর origin-এর সঙ্গে মিলতে হবে; `APP_URL` পরিবর্তন করলে redeploy করো।

API syntax ও documentation উদাহরণ end-to-end provider connectivity নিশ্চিত করে না। Production endpoint নিজে পরীক্ষা করো এবং Vercel logs-এ error দেখো—secret value log বা share করবে না।
