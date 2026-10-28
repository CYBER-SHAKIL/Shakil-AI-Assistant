# Shakil AI Assistant

Shakil AI Assistant is a Bangla-first AI web app with a single-file frontend and Vercel serverless API routes.

## API key security model

There are two route groups:

- **External integrations:** `POST /api/chat` and `POST /api/generate-image` require a valid Shakil API key in `Authorization: Bearer sk-shakil-...`. Missing, malformed, invalid, or revoked keys are rejected.
- **Website UI:** `POST /api/public/chat` and `POST /api/public/generate-image` preserve the website's public-access flow. These routes are not a substitute for private external API authentication; configure Turnstile and rate limiting for public use.
- **Model list:** `GET /api/models` is public because the website needs it to populate the model selector. It never returns provider credentials.

API keys use the `sk-shakil-` prefix and 32 cryptographically random bytes. Only the SHA-256 digest and non-secret metadata are stored in Firebase Realtime Database. The raw key is returned only by the create action and cannot be recovered later. Revoke a compromised key immediately.

There is intentionally no browser-based admin form: the admin secret must not be embedded in frontend JavaScript. Use a trusted server-side script or an HTTPS API client to manage keys. The create response contains the new key once; copy it into your secret manager before closing the response.

## Vercel environment variables

In Vercel Dashboard → Project → **Settings → Environment Variables**, add the variables needed for the environments you deploy. Set secrets only on the server side. If you change a variable, redeploy the affected environment for the new value to be used.

| Variable | Required for | Notes |
| --- | --- | --- |
| `FIREBASE_SERVICE_ACCOUNT_JSON` | Key create/list/revoke and API-key verification | Full service-account JSON, server-only. Must include `client_email` and `private_key`. |
| `FIREBASE_DATABASE_URL` | Key create/list/revoke and API-key verification | Realtime Database URL, e.g. `https://PROJECT-default-rtdb.firebaseio.com` or a `.firebasedatabase.app` URL. |
| `API_KEY_ADMIN_SECRET` | Key create/list/revoke | Strong private admin secret. Never place it in `index.html`, browser storage, or public repositories. |
| `OPENROUTER_API_KEY` | Chat and model discovery | Provider secret; server-side only. |
| `CLOUDFLARE_ACCOUNT_ID` | Image generation | Cloudflare account ID. |
| `CLOUDFLARE_API_TOKEN` | Image generation | Workers AI permissions required; server-side only. |
| `APP_URL` | Canonical app origin and CORS | Use the deployed website's origin. |
| `UPSTASH_REDIS_REST_URL` | Persistent rate limiting | Recommended with `UPSTASH_REDIS_REST_TOKEN`. |
| `UPSTASH_REDIS_REST_TOKEN` | Persistent rate limiting | Recommended; without both Upstash variables, rate limiting falls back to per-instance memory. |
| `TURNSTILE_SECRET_KEY` | Public website routes | Optional. If set, public requests must include a valid Turnstile token. |
| `TAVILY_API_KEY` | Optional web search | Server-side only. |

Optional limit overrides: `CHAT_RATE_LIMIT_PER_MINUTE` (20), `API_KEY_DAILY_CHAT_LIMIT` (500), `IMAGE_DAILY_LIMIT_PER_IP` (5), `IMAGE_DAILY_LIMIT_PER_KEY` (20), `IMAGE_GLOBAL_DAILY_LIMIT` (100), `WEB_SEARCH_DAILY_GLOBAL_LIMIT` (1000), `WEB_SEARCH_DAILY_IP_LIMIT` (20), and `WEB_SEARCH_DAILY_KEY_LIMIT` (100).

### Firebase service account setup

1. In Google/Firebase console, create or select a service account with permission to access the project's Realtime Database.
2. Store the entire service-account JSON as `FIREBASE_SERVICE_ACCOUNT_JSON` in Vercel. Preserve the JSON as a single environment-variable value, including the escaped newlines in `private_key`.
3. Set `FIREBASE_DATABASE_URL` to the exact Realtime Database URL for that project.
4. Set a strong random `API_KEY_ADMIN_SECRET`.
5. Apply these values to **Production**, **Preview**, and/or **Development** as needed, then redeploy those environments.
6. Test key creation, list, authenticated chat, and revocation. Do not share secrets in chat or commit them to Git.

## API routes

| Method | Route | Authentication |
| --- | --- | --- |
| POST | `/api/keys` | `API_KEY_ADMIN_SECRET` in JSON body; rate-limited |
| POST | `/api/chat` | Required Shakil Bearer key |
| POST | `/api/generate-image` | Required Shakil Bearer key |
| GET | `/api/models` | Public; requires server-side OpenRouter configuration |
| POST | `/api/public/chat` | Public website flow; optional Turnstile enforcement |
| POST | `/api/public/generate-image` | Public website flow; optional Turnstile enforcement |

See [API.md](./API.md) for request formats, example server code, success/error responses, and troubleshooting.

## Important security notes

- Never put `SHAKIL_API_KEY`, `API_KEY_ADMIN_SECRET`, Firebase service-account JSON, OpenRouter keys, or Cloudflare tokens in frontend JavaScript, local storage, or a public repository.
- External integrations must call the authenticated routes, not the `/api/public/*` routes.
- API key hashes are used as Firebase record IDs; raw issued keys are not saved.
- A successful Vercel deployment does not prove provider credentials or Firebase connectivity work. Test the actual routes after deployment.
- Rate limiting without Upstash is per serverless instance and is not a deployment-wide guarantee.
