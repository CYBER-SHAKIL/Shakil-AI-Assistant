# Shakil AI Assistant

**Shakil AI Assistant** একটি বাংলা-প্রথম AI chat web app। Frontend একটি static `index.html`; backend Vercel Serverless Functions-এ চলে।

## প্রধান সুবিধা

- বাংলা ও ইংরেজি প্রশ্নোত্তর, লেখা, পড়াশোনা, গণিত এবং coding help।
- OpenRouter-এর free chat model এবং `openrouter/free` Auto routing।
- সমর্থিত vision model বেছে নিলে chat-এ সংযুক্ত ছবির বিশ্লেষণ।
- Tavily API configure থাকলে web search ও উৎসের URL।
- Cloudflare Workers AI-এর `@cf/black-forest-labs/flux-1-schnell` দিয়ে text-to-image generation।
- Browser-এ IndexedDB-তে chat history ও image blob সংরক্ষণ; পুরোনো localStorage history থাকলে migration।
- Image upload-এর আগে browser-side resize/compression।
- Firebase Realtime Database-ভিত্তিক project API key manager (সংশ্লিষ্ট server env configure করা থাকলে)।
- Provider API key frontend-এ না রেখে server-side-এ রাখা।

## Project structure

- `index.html` — UI, CSS ও browser JavaScript।
- `api/chat.js` — chat, streaming, calculator এবং optional web search।
- `api/models.js` — OpenRouter-এর উপলব্ধ free model তালিকা।
- `api/generate-image.js` — Cloudflare Workers AI image generation।
- `api/keys.js` — project API key create/list/revoke।
- `api/_lib/auth.js` — request parsing, API key check, Turnstile ও rate limit।
- `api/_lib/firebase.js` — Firebase service-account token এবং database access।
- `vercel.json` — serverless function configuration।

## Vercel environment variables

Vercel Dashboard → Project → **Settings → Environment Variables** থেকে প্রয়োজনীয় variable যোগ করো। Secret value GitHub, `index.html`, browser storage বা public chat-এ রাখবে না। Variable যোগ/পরিবর্তনের পরে নতুন deployment/redeploy করো।

| Variable | প্রয়োজন/ব্যবহার |
| --- | --- |
| `OPENROUTER_API_KEY` | Chat ও model discovery-এর জন্য প্রয়োজন; Bengali image prompt enhancement-এও ব্যবহার হতে পারে। |
| `APP_URL` | App-এর canonical origin; OpenRouter headers ও image API CORS-এ ব্যবহৃত হয়। Production URL-এর সঙ্গে মিলিয়ে দাও। |
| `OPENROUTER_DEFAULT_MODEL` | ঐচ্ছিক configuration; current chat implementation-এর Auto fallback `openrouter/free`। |
| `CLOUDFLARE_ACCOUNT_ID` | Image generation চালাতে প্রয়োজন। |
| `CLOUDFLARE_API_TOKEN` | Workers AI ব্যবহারের permission-সহ token; image generation চালাতে প্রয়োজন। |
| `TAVILY_API_KEY` | ঐচ্ছিক; live web search-এর জন্য। |
| `UPSTASH_REDIS_REST_URL` এবং `UPSTASH_REDIS_REST_TOKEN` | ঐচ্ছিক কিন্তু সুপারিশকৃত; deployment জুড়ে persistent rate limiting। |
| `TURNSTILE_SECRET_KEY` | ঐচ্ছিক; সেট করা থাকলে server Turnstile verification চালায়। না থাকলে এই server-side verification bypass হয়। |
| `FIREBASE_SERVICE_ACCOUNT_JSON` | Project API key manager-এর জন্য service-account JSON; server-only। |
| `FIREBASE_DATABASE_URL` | Firebase Realtime Database URL; key manager-এর জন্য প্রয়োজন। |
| `API_KEY_ADMIN_SECRET` | Project API key create/list/revoke করার admin secret; server-only। |

### Optional limit variables

নিচের variable না দিলে code-এ থাকা default ব্যবহার হয়। এগুলো চাইলে Vercel-এ override করা যায়।

| Variable | Default |
| --- | ---: |
| `CHAT_RATE_LIMIT_PER_MINUTE` | প্রতি IP-তে 20 chat request/minute |
| `API_KEY_DAILY_CHAT_LIMIT` | প্রতি project API key-তে 500 chat request/day |
| `IMAGE_DAILY_LIMIT_PER_IP` | প্রতি IP-তে 5 image/day |
| `IMAGE_DAILY_LIMIT_PER_KEY` | প্রতি project API key-তে 20 image/day |
| `IMAGE_GLOBAL_DAILY_LIMIT` | সব image request মিলিয়ে 100/day |
| `WEB_SEARCH_DAILY_GLOBAL_LIMIT` | 1000 search/day |
| `WEB_SEARCH_DAILY_IP_LIMIT` | প্রতি IP-তে 20 search/day |
| `WEB_SEARCH_DAILY_KEY_LIMIT` | প্রতি project API key-তে 100 search/day |

Rate limiting-এর জন্য Upstash configure না থাকলে fallback in-memory এবং serverless instance-ভিত্তিক; এটি persistent বা deployment-wide guarantee নয়।

## Chat ব্যবহার

সাধারণ chat করতে message পাঠাও। ছবি বিশ্লেষণের জন্য image attach করে image-input/vision সমর্থনকারী model নির্বাচন করো। Auto routing সব সময় নির্দিষ্ট vision model নির্বাচন করবে—এমন নিশ্চয়তা নেই।

## ছবি তৈরি

Chat-এ explicit command ব্যবহার করো:

```text
/image বাংলার নদীর ধারে সূর্যাস্ত, cinematic lighting
```

Image generation-এর জন্য Cloudflare account ID ও Workers AI permission-সহ API token লাগবে। Bengali prompt উন্নত করার জন্য OpenRouter key থাকলে সেটি চেষ্টা করা হয়; enhancement ব্যর্থ হলে মূল prompt দিয়েই এগোয়। Reference image থেকে image-to-image generation এখনো সমর্থিত নয়। Provider-এর usage limit বা charge থাকতে পারে; কোনো service unlimited/free ধরে নিও না।

## API routes

- `POST /api/chat` — chat; `stream: true` হলে SSE।
- `GET /api/models` — free OpenRouter model তালিকা।
- `POST /api/generate-image` — image তৈরি।
- `POST /api/keys` — admin secret দিয়ে project API key create/list/revoke।

Request/response উদাহরণ, headers ও error troubleshooting-এর জন্য [API.md](./API.md) দেখো।

## Security notes

- OpenRouter, Cloudflare, Tavily, Firebase service-account এবং admin secret কখনো browser code-এ রেখো না।
- Project API key-এর raw value শুধু create response-এ একবার দেখানো হয়; database-এ SHA-256 hash ও metadata রাখা হয়।
- Project key revoke করলে সেটি আর ব্যবহার করা উচিত নয়; key manager-এর Firebase configuration ঠিক থাকা প্রয়োজন।
- Public endpoint-এর usage monitor করো এবং provider limits খেয়াল রাখো।
- Turnstile secret না থাকলে server-side Turnstile check সক্রিয় নয়। Upstash variables না থাকলে rate limit persistent নয়।

## Deployment ও smoke test

Connected GitHub `main` branch-এ change merge হলে Vercel deployment চালু হতে পারে। Vercel-এ deployment `READY` হওয়া build/deploy সফল হওয়ার ইঙ্গিত, কিন্তু প্রতিটি live API call সফল—তার প্রমাণ নয়।

1. Production site খুলে একটি বাংলা chat প্রশ্ন পাঠাও।
2. `GET /api/models` খুলে JSON-এ `models` আছে কি না দেখো।
3. Cloudflare variables configure করা থাকলে `/image a simple landscape at sunset` পরীক্ষা করো।
4. Vision-capable model নির্বাচন করে একটি ছবি attach করে প্রশ্ন করো।
5. Tavily configure থাকলে সাম্প্রতিক তথ্যের প্রশ্ন করে উত্তরে `সূত্র:` অংশ দেখো।
6. Settings থেকে API key manager পরীক্ষা করো—শুধু Firebase ও admin secret configure করা থাকলে।
