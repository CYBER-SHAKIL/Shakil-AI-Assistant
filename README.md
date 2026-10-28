# Shakil AI Assistant

Shakil AI Assistant একটি বাংলা-প্রথম AI chat web app। Frontend হলো static `index.html`; backend Vercel Serverless Functions-এ চলে।

- Live: https://shakil-ai-assistant-pro.vercel.app
- Repository: https://github.com/CYBER-SHAKIL/Shakil-AI-Assistant

## ফিচার
- বাংলা/ইংরেজি chat, coding ও study assistance।
- OpenRouter free models, streaming, stop, regenerate, edit ও conversation history।
- Vision-support করা model দিয়ে image understanding।
- `/image` command দিয়ে Cloudflare Workers AI image generation।
- Tavily configure থাকলে web search ও source URL।
- Calculator এবং সীমিত web-search tool calling; arbitrary shell execution নয়।
- IndexedDB conversation/image storage এবং Firebase configure থাকলে project API key management।

## API routes
- `POST /api/chat` — chat, streaming, calculator, optional web search।
- `GET /api/models` — free model list।
- `POST /api/generate-image` — image generation।
- `POST /api/keys` — project API key management।

## Vercel environment variables
Vercel → Project → Settings → Environment Variables-এ প্রয়োজনমতো configure করে redeploy করো। Secret কখনো frontend বা GitHub-এ রেখো না।

| Variable | ব্যবহার |
|---|---|
| `OPENROUTER_API_KEY` | Chat ও prompt enhancement |
| `APP_URL` | Production origin/CORS; `https://shakil-ai-assistant-pro.vercel.app` |
| `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_API_TOKEN` | Image generation |
| `TAVILY_API_KEY` | Optional web search |
| `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` | Persistent rate limit |
| `TURNSTILE_SECRET_KEY` | Server-side Turnstile verification |
| `FIREBASE_SERVICE_ACCOUNT_JSON`, `FIREBASE_DATABASE_URL`, `API_KEY_ADMIN_SECRET` | Project API key manager |

ঐচ্ছিক tuning: `OPENROUTER_DEFAULT_MODEL`, `OPENROUTER_IMAGE_PROMPT_MODEL`, `CHAT_RATE_LIMIT_PER_MINUTE`, `API_KEY_DAILY_CHAT_LIMIT`, `WEB_SEARCH_DAILY_GLOBAL_LIMIT`, `WEB_SEARCH_DAILY_IP_LIMIT`, `WEB_SEARCH_DAILY_KEY_LIMIT`, `IMAGE_DAILY_LIMIT_PER_IP`, `IMAGE_DAILY_LIMIT_PER_KEY`, `IMAGE_GLOBAL_DAILY_LIMIT`। না থাকলে code default limit ব্যবহার করতে পারে। `CHAT_GLOBAL_DAILY` দরকার নেই।

Firebase service-account credential প্রকাশ হয়ে থাকলে revoke করে নতুন credential তৈরি করো। Admin secret দীর্ঘ ও random রাখো; কখনো browser-এ রেখো না।

## Image generation
Chat-এ `/image বাংলার নদীর ধারে সূর্যাস্ত` লিখো। Cloudflare account ID/token আবশ্যক। ইংরেজি prompt সরাসরি পাঠানো হয়; বাংলা prompt enhancement ব্যর্থ হলে মূল prompt দিয়ে চেষ্টা হতে পারে। Image-to-image বর্তমানে সমর্থিত নয়। Provider usage/limits প্রযোজ্য।

## Deploy ও test
`main` branch-এর commit Vercel deployment trigger করতে পারে। `READY` build success বোঝায়, সব live API কাজ করছে তার নিশ্চয়তা নয়। `vercel.json`-এ chat/image function-এর `maxDuration: 60` আছে; কার্যকর limit Vercel plan অনুযায়ী যাচাই করো। বিস্তারিত: [API.md](./API.md)

Smoke test: assistant name/creator প্রশ্ন, বাংলা chat, coding, ৩০টির বেশি message, `/image`, vision model-এ attachment, Tavily source, Stop/regenerate/edit/history এবং Firebase key manager পরীক্ষা করো। Free model availability, limits ও cost পরিবর্তিত হতে পারে; unlimited ধরে নিও না।
