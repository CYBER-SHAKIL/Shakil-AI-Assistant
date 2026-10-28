"use strict";
const crypto = require("node:crypto");
const TOKEN_URL = "https://oauth2.googleapis.com/token";
let cachedToken = "";
let cachedUntil = 0;
let tokenPromise = null;

function serviceAccount() {
  let account;
  try { account = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON || "{}"); } catch {}
  if (!account?.client_email || !account?.private_key) throw new Error("Firebase service account is not configured.");
  return account;
}
function databaseUrl() {
  const value = String(process.env.FIREBASE_DATABASE_URL || "").replace(/\/$/, "");
  if (!/^https:\/\/.+\.(?:firebasedatabase\.app|firebaseio\.com)$/.test(value)) {
    throw new Error("Firebase Realtime Database URL is not configured.");
  }
  return value;
}
async function accessToken() {
  if (cachedToken && Date.now() < cachedUntil - 60000) return cachedToken;
  if (tokenPromise) return tokenPromise;
  tokenPromise = (async () => {
    const account = serviceAccount();
    const now = Math.floor(Date.now() / 1000);
    const b64 = value => Buffer.from(value).toString("base64url");
    const unsigned = b64(JSON.stringify({alg:"RS256",typ:"JWT"})) + "." +
      b64(JSON.stringify({iss:account.client_email,scope:"https://www.googleapis.com/auth/firebase.database https://www.googleapis.com/auth/userinfo.email",aud:account.token_uri || TOKEN_URL,iat:now,exp:now+3600}));
    const signer = crypto.createSign("RSA-SHA256");
    signer.update(unsigned); signer.end();
    const assertion = unsigned + "." + signer.sign(account.private_key,"base64url");
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10000);
    try {
      const response = await fetch(account.token_uri || TOKEN_URL, {
        method:"POST", headers:{"Content-Type":"application/x-www-form-urlencoded"},
        body:new URLSearchParams({grant_type:"urn:ietf:params:oauth:grant-type:jwt-bearer",assertion}), signal:controller.signal
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.access_token) throw new Error("Google OAuth token request failed.");
      cachedToken = data.access_token;
      cachedUntil = Date.now() + Number(data.expires_in || 3600) * 1000;
      return cachedToken;
    } finally { clearTimeout(timer); }
  })();
  try { return await tokenPromise; } finally { tokenPromise = null; }
}
async function db(path, method="GET", value) {
  if (typeof path !== "string" || path.split("/").some(part => !part || part === "." || part === "..")) throw new Error("Invalid Firebase path.");
  const token = await accessToken();
  const response = await fetch(databaseUrl() + "/" + path.split("/").map(encodeURIComponent).join("/") + ".json", {
    method, headers:{Authorization:"Bearer "+token,"Content-Type":"application/json"},
    ...(value === undefined ? {} : {body:JSON.stringify(value)})
  });
  const text = await response.text();
  let data = null; try { data = text ? JSON.parse(text) : null; } catch {}
  if (!response.ok) throw new Error("Firebase Realtime Database request failed ("+response.status+").");
  return data;
}
async function verifyShakilApiKey(key) {
  // 32 random bytes encoded as base64url always produce 43 characters.
  if (typeof key !== "string" || !/^sk-shakil-[A-Za-z0-9_-]{43}$/.test(key)) return false;
  const hash = crypto.createHash("sha256").update(key).digest("hex");
  // Let Firebase/configuration failures propagate so callers can return 503,
  // rather than incorrectly reporting an infrastructure outage as a bad key.
  const record = await db("shakilApiKeys/" + hash);
  if (!record || record.revoked !== false || typeof record.createdAt !== "string" || typeof record.prefix !== "string") return false;
  // Firebase is queried by the SHA-256 digest itself, so the record is only found
  // at the exact digest path. Admin secrets use timingSafeEqual in keys.js.
  return true;
}
module.exports = { accessToken, db, verifyShakilApiKey };
