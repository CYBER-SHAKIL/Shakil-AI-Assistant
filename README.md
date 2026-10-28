# Shakil AI Assistant

**Shakil AI Assistant** হলো বাংলা-প্রথম একটি AI ওয়েব অ্যাসিস্ট্যান্ট। এটি একক `index.html` ফ্রন্টএন্ড, Vercel Serverless API, OpenRouter-এর ফ্রি AI মডেল, Cloudflare Workers AI এবং Firebase-ভিত্তিক অ্যাকাউন্ট/API Key ব্যবস্থাপনা ব্যবহার করে।

- **লাইভ ওয়েবসাইট:** https://shakil-ai-assistant-pro.vercel.app/
- **GitHub রিপোজিটরি:** https://github.com/CYBER-SHAKIL/Shakil-AI-Assistant
- **নির্মাতা:** Shakil

## ✨ প্রধান সুবিধা

- **AI Chat:** প্রশ্নোত্তর, ব্যাখ্যা, লেখা তৈরি, পড়াশোনার সহায়তা এবং কোড লেখা/ডিবাগ করার সুবিধা।
- **বাংলা-প্রথম অভিজ্ঞতা:** সাধারণ উত্তরে বাংলা ব্যবহারের জন্য নির্দেশনা রয়েছে; প্রয়োজন হলে ইংরেজি প্রযুক্তিগত শব্দ ব্যবহার করা হয়।
- **ফ্রি মডেল নির্বাচন:** OpenRouter থেকে পাওয়া বিনামূল্যের মডেল ও `openrouter/free` রাউটার দেখানোর ব্যবস্থা।
- **মডেল fallback:** নির্বাচিত মডেল ব্যর্থ হলে বিকল্প ফ্রি মডেল চেষ্টা করা হয়; তবে সব মডেল ব্যর্থ হলে উত্তর নাও আসতে পারে।
- **ছবি তৈরি:** Cloudflare Workers AI-এর FLUX মডেল দিয়ে টেক্সট প্রম্পট থেকে ছবি তৈরির ব্যাকএন্ড।
- **ছবি বোঝা:** সংযুক্ত ছবি বিশ্লেষণের সুবিধা উপযুক্ত vision-সমর্থিত মডেল ও ফ্রন্টএন্ডে ছবির সংযুক্তি ঠিকভাবে পাঠানোর ওপর নির্ভর করে।
- **অ্যাকাউন্ট লগইন:** Firebase Authentication-এর Email/Password, Google এবং GitHub লগইন UI।
- **নিজস্ব API Key:** `sk-shakil-` দিয়ে শুরু হওয়া Key তৈরি, তালিকা দেখা এবং মুছে ফেলার সুবিধা।
- **Admin Overview:** যাচাইকৃত নির্ধারিত Admin অ্যাকাউন্ট মোট ট্র্যাক করা অ্যাকাউন্ট, ইউজারের নাম/ইমেইল/প্রোফাইল ছবি এবং সক্রিয় API Key-এর হিসাব দেখতে পারে।
- **অ্যাকাউন্টভিত্তিক Chat History:** একই ব্রাউজার/ডিভাইসে আলাদা অ্যাকাউন্টের কথোপকথন আলাদা করে রাখা হয়।
- **সহজ ওয়েব UI:** ডার্ক/লাইট থিম, কথোপকথনের তালিকা এবং ছবি সংযুক্তির UI।

## 🛡️ Admin Panel

নির্ধারিত Admin ইমেইল: `shakil.dev.pro@gmail.com`

Admin সুবিধা পেতে এই অ্যাকাউন্টে লগইন করার পাশাপাশি ইমেইলটি Firebase-এ verified হতে হবে। এরপর প্রোফাইল থেকে **Open Admin Panel** অপশন পাওয়ার কথা।

Admin Overview-এ:
- **Total Accounts:** `shakilUsers` ডেটাবেসে ট্র্যাক হওয়া অ্যাকাউন্টের সংখ্যা।
- **All Users:** সংরক্ষিত নাম, ইমেইল, প্রোফাইল ছবি ও সর্বশেষ লগইনের সময়।
- **প্রতি ইউজারের API Key সংখ্যা:** বর্তমানে ডেটাবেসে থাকা এবং revoke/delete না করা Key-এর সংখ্যা।
- **Total Active API Keys:** সব ইউজারের সক্রিয় Key-এর মোট সংখ্যা।

**গণনার সীমা:** অ্যাকাউন্ট ট্র্যাকিং চালু হওয়ার পর লগইন করা ইউজারদের তথ্যই তালিকায় আসবে। আগে লগইন করা প্রত্যেক অ্যাকাউন্ট স্বয়ংক্রিয়ভাবে পুরোনো ইতিহাসসহ যুক্ত হবে—এমন নিশ্চয়তা নেই। মুছে ফেলা Key-এর পুরোনো রেকর্ড এই গণনায় থাকে না। Admin Panel-এর জন্য Firebase Realtime Database ও সার্ভার পরিবেশের সেটিংস সঠিক থাকতে হবে।

## 💬 Chat History কীভাবে কাজ করে

বর্তমান বাস্তবায়নে Chat History ব্রাউজারের IndexedDB-তে অ্যাকাউন্টভিত্তিকভাবে সংরক্ষিত হয়।

- একই ডিভাইস/ব্রাউজারে একই অ্যাকাউন্টে আবার লগইন করলে সেই অ্যাকাউন্টের সংরক্ষিত ইতিহাস দেখা যাবে।
- অন্য অ্যাকাউন্টের ইতিহাস আলাদা থাকে।
- লগআউট করলে আগের অ্যাকাউন্টের ইতিহাস স্বয়ংক্রিয়ভাবে ডিলিট হয় না।
- **সীমাবদ্ধতা:** ইতিহাস এখনো Firebase-এ ক্লাউড সিঙ্ক হয় না। অন্য ডিভাইস বা ব্রাউজারে একই ইতিহাস পেতে ক্লাউড Chat History ব্যবস্থা আলাদাভাবে বাস্তবায়ন করতে হবে। ব্রাউজারের ডেটা মুছে দিলে লোকাল ইতিহাস হারাতে পারে।

## ⚙️ ব্যবহৃত প্রযুক্তি

- **Frontend:** HTML, CSS ও JavaScript — একক `index.html`
- **Backend:** Vercel Serverless Functions (Node.js/CommonJS)
- **Chat AI ও মডেল তালিকা:** OpenRouter
- **ছবি তৈরি:** Cloudflare Workers AI — `@cf/black-forest-labs/flux-1-schnell`
- **অ্যাকাউন্ট:** Firebase Authentication
- **API Key ও অ্যাকাউন্ট মেটাডেটা:** Firebase Realtime Database
- **Key সুরক্ষা:** SHA-256 hash; আসল API Key ডেটাবেসে সংরক্ষণ করা হয় না
- **ঐচ্ছিক সীমা নিয়ন্ত্রণ:** Upstash Redis
- **ঐচ্ছিক বট-সুরক্ষা:** Cloudflare Turnstile
- **ঐচ্ছিক ওয়েব সার্চ:** Tavily

## 🚀 Vercel-এ প্রয়োজনীয় Environment Variables

Vercel Dashboard → Project → **Settings → Environment Variables** থেকে প্রয়োজনীয় ভেরিয়েবল যোগ করতে হবে। Secret কখনো ফ্রন্টএন্ড কোডে বা পাবলিক GitHub ফাইলে রাখবে না।

| ভেরিয়েবল | কেন দরকার |
| --- | --- |
| `FIREBASE_SERVICE_ACCOUNT_JSON` | সার্ভার থেকে Firebase Realtime Database-এ নিরাপদে প্রবেশ ও API Key পরিচালনা |
| `FIREBASE_DATABASE_URL` | Firebase Realtime Database-এর সঠিক URL |
| `FIREBASE_PROJECT_ID` | প্রয়োজন হলে Firebase প্রজেক্ট শনাক্ত করতে; এই প্রজেক্টে `shakil-dev-pro` |
| `OPENROUTER_API_KEY` | AI Chat ও ফ্রি মডেলের তালিকা |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare Workers AI অ্যাকাউন্ট শনাক্ত করতে |
| `CLOUDFLARE_API_TOKEN` | Cloudflare Workers AI ব্যবহার করতে |
| `APP_URL` | ওয়েবসাইটের মূল URL ও CORS সেটিংস |
| `UPSTASH_REDIS_REST_URL` | ঐচ্ছিক, সার্ভারগুলোর মধ্যে স্থায়ী rate limit |
| `UPSTASH_REDIS_REST_TOKEN` | ঐচ্ছিক Upstash অনুমোদন |
| `TURNSTILE_SECRET_KEY` | ঐচ্ছিক, পাবলিক অনুরোধে Turnstile যাচাই |
| `TAVILY_API_KEY` | ঐচ্ছিক ওয়েব সার্চ |

ঐচ্ছিক সীমা পরিবর্তনের ভেরিয়েবল: `CHAT_RATE_LIMIT_PER_MINUTE`, `API_KEY_DAILY_CHAT_LIMIT`, `IMAGE_DAILY_LIMIT_PER_IP`, `IMAGE_DAILY_LIMIT_PER_KEY`, `IMAGE_GLOBAL_DAILY_LIMIT`, `WEB_SEARCH_DAILY_GLOBAL_LIMIT`, `WEB_SEARCH_DAILY_IP_LIMIT`, `WEB_SEARCH_DAILY_KEY_LIMIT`।

পরিবর্তন করার পরে সংশ্লিষ্ট Vercel পরিবেশে নতুন deployment করো। Firebase Authentication-এ ব্যবহার করতে চাওয়া sign-in provider এবং Authorized Domains চালু আছে কি না পরীক্ষা করো।

## 🔌 API Routes

| Method | Route | কাজ / অনুমোদন |
| --- | --- | --- |
| `POST` | `/api/keys` | Firebase ID Token দিয়ে API Key তৈরি, তালিকা, মুছে ফেলা এবং Admin Overview |
| `POST` | `/api/chat` | Shakil API Key-সহ অনুমোদিত Chat অনুরোধ |
| `POST` | `/api/generate-image` | Shakil API Key-সহ ছবি তৈরি |
| `GET` | `/api/models` | উপলভ্য ফ্রি মডেলের তালিকা |
| `POST` | `/api/public/chat` | ওয়েবসাইটের পাবলিক Chat flow; সেট করা থাকলে Turnstile যাচাই |
| `POST` | `/api/public/generate-image` | ওয়েবসাইটের পাবলিক Image flow; সেট করা থাকলে Turnstile যাচাই |

অনুরোধের JSON, উদাহরণ, সফল/ব্যর্থ উত্তরের ফরম্যাট এবং সমস্যা সমাধানের জন্য [API.md](./API.md) দেখো।

## ⚠️ সীমাবদ্ধতা ও খারাপ দিক

কোনো AI সিস্টেমই সব সময় নির্ভুল বা অবিচ্ছিন্নভাবে সচল থাকার নিশ্চয়তা দিতে পারে না। এই প্রজেক্টের গুরুত্বপূর্ণ সীমাবদ্ধতাগুলো হলো:

1. **ফ্রি মডেলের সীমা:** OpenRouter-এর ফ্রি মডেলে ট্রাফিক, rate limit, মডেল বন্ধ থাকা বা provider-এর পরিবর্তনের কারণে উত্তর ধীর হতে পারে বা ব্যর্থ হতে পারে।
2. **ছবি তৈরির কোটা:** Cloudflare Workers AI-এর অ্যাকাউন্ট, token, ব্যবহারসীমা এবং সার্ভিসের অবস্থার ওপর ছবি তৈরি নির্ভর করে। কনফিগারেশন না থাকলে ছবি তৈরি হবে না।
3. **ছবি থেকে ছবি তৈরি:** বর্তমান image-generation endpoint reference image দিয়ে image-to-image generation সমর্থন করে না; এটি টেক্সট প্রম্পট থেকে ছবি তৈরি করে।
4. **Chat History ক্লাউডে নেই:** কথোপকথন একই ব্রাউজার/ডিভাইসে সংরক্ষিত; সব ডিভাইসে স্বয়ংক্রিয়ভাবে সিঙ্ক হয় না।
5. **Admin তালিকা সম্পূর্ণ পুরোনো হিস্ট্রি নয়:** ট্র্যাকিং শুরু হওয়ার আগে তৈরি হওয়া সব অ্যাকাউন্টের রেকর্ড নাও থাকতে পারে।
6. **API Key একবারই দেখানো হয়:** Key তৈরি হওয়ার সময় কপি করে নিরাপদে রাখতে হবে। আসল Key পরে ডেটাবেস থেকে পুনরুদ্ধার করা যায় না।
7. **Deployment মানেই সব ঠিক নয়:** Vercel deployment সফল হলেও OpenRouter, Cloudflare বা Firebase-এর credential এবং API বাস্তবে কাজ করছে কি না আলাদাভাবে পরীক্ষা করতে হবে।
8. **Rate limit-এর সীমা:** Upstash সেট না থাকলে কিছু সীমা সার্ভারless instance-ভিত্তিক হতে পারে; এটি পুরো deployment জুড়ে একক নির্ভুল সীমা নিশ্চিত করে না।
9. **AI ভুল করতে পারে:** উত্তর যাচাই না করে গুরুত্বপূর্ণ সিদ্ধান্ত নেওয়া উচিত নয়; ব্যক্তিগত বা গোপন তথ্য prompt-এ দেওয়ার সময় সতর্ক থাকতে হবে।
10. **Provider নির্ভরতা:** OpenRouter, Cloudflare, Firebase এবং Vercel-এর নীতি, মূল্য বা উপলভ্যতা পরিবর্তিত হলে প্রজেক্টেও পরিবর্তন লাগতে পারে।

## ✅ ভালো দিক ও ❌ খারাপ দিক — সংক্ষেপে

| ভালো দিক | খারাপ দিক / সীমা |
| --- | --- |
| বাংলা-প্রথম AI অভিজ্ঞতা | ফ্রি মডেল সব সময় সচল নাও থাকতে পারে |
| এক জায়গায় Chat ও ছবি তৈরির সুবিধা | ছবি তৈরিতে Cloudflare সেটআপ ও কোটা দরকার |
| নিজস্ব API Key ও Key মুছে ফেলার ব্যবস্থা | Key তৈরি হলে আসল মানটি শুধু একবার দেখানো হয় |
| Admin-এ ইউজার ও সক্রিয় Key-এর হিসাব | পুরোনো অ্যাকাউন্টের তথ্য অসম্পূর্ণ হতে পারে |
| একই ডিভাইসে অ্যাকাউন্টভিত্তিক Chat History | ক্লাউড সিঙ্ক এখনো নেই |
| Vercel-এ deploy করা যায় | credential ও provider status নিজে পরীক্ষা করতে হয় |

## 🔐 নিরাপত্তা নির্দেশনা

- `OPENROUTER_API_KEY`, `CLOUDFLARE_API_TOKEN`, Firebase service-account JSON এবং অন্য secret কখনো `index.html`, browser storage বা GitHub-এ যোগ করবে না।
- API Key-এর raw value সংরক্ষণ করা হয় না; SHA-256 hash দিয়ে যাচাই করা হয়।
- API Key প্রকাশ হয়ে গেলে সেটি মুছে/রিভোক করে নতুন Key তৈরি করো।
- Admin Overview শুধু সার্ভার থেকে যাচাই করা নির্দিষ্ট, verified Admin ইমেইলের জন্য অনুমোদিত।
- পাবলিক route ব্যবহারের ক্ষেত্রে rate limit ও Turnstile যথাযথভাবে কনফিগার করো।
- API বা লগে password, access token বা secret প্রকাশ করো না।

## 🧪 Deployment-এর পর পরীক্ষা

1. ওয়েবসাইট খুলে সাধারণ Chat পরীক্ষা করো।
2. Firebase-এ লগইন/লগআউট এবং পুনরায় লগইন পরীক্ষা করো।
3. API Key তৈরি, তালিকাভুক্ত করা এবং মুছে ফেলা পরীক্ষা করো।
4. Admin অ্যাকাউন্ট দিয়ে Admin Overview ও ইউজার/Key-এর সংখ্যা যাচাই করো।
5. Cloudflare কনফিগার থাকলে ছবি তৈরি পরীক্ষা করো।
6. অন্য অ্যাকাউন্টে লগইন করে নিশ্চিত হও যে Chat History আলাদা আছে।
7. Vercel Logs-এ provider বা database error আছে কি না পরীক্ষা করো।

## 📄 লাইসেন্স ও ব্যবহার

এই রিপোজিটরিতে স্পষ্ট লাইসেন্স ফাইল না থাকলে পুনর্বিতরণ, বাণিজ্যিক ব্যবহার বা কপি করার অধিকার স্বয়ংক্রিয়ভাবে অনুমোদিত ধরে নেওয়া উচিত নয়। ব্যবহারের আগে রিপোজিটরির লাইসেন্স ও সংশ্লিষ্ট provider-এর শর্তাবলি পরীক্ষা করো।

---

**Shakil AI Assistant — বাংলা ভাষায় AI সহায়তা, এক জায়গায়।** 💙
