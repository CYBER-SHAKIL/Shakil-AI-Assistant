const crypto = require("node:crypto");
const TOKEN_URL = "https://oauth2.googleapis.com/token";
let cachedToken = "", cachedUntil = 0;
function json(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(body));
}
function base64url(value) { return Buffer.from(value).toString("base64url"); }
function getServiceAccount() {
  let account;
  try { account = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON || "{}"); } catch {}
  if (!account?.client_email || !account?.private_key) throw new Error("Set a newly rotated FIREBASE_SERVICE_ACCOUNT_JSON in Vercel.");
  return account;
}
async function accessToken() {
  if (cachedToken && Date.now() < cachedUntil - 60000) return cachedToken;
  const account = getServiceAccount();
  const now = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = base64url(JSON.stringify({ iss: account.client_email, scope: "https://www.googleapis.com/auth/firebase.database https://www.googleapis.com/auth/userinfo.email", aud: account.token_uri || TOKEN_URL, iat: now, exp: now + 3600 }));
  const unsigned = header + "." + claims;
  const signer = crypto.createSign("RSA-SHA256");
  signer.update(unsigned);
  signer.end();
  const assertion = unsigned + "." + signer.sign(account.private_key, "base64url");
  const response = await fetch(account.token_uri || TOKEN_URL, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion }) });
  const data = await response.json();
  if (!response.ok || !data.access_token) throw new Error("Google OAuth token request failed.");
  cachedToken = data.access_token;
  cachedUntil = Date.now() + Number(data.expires_in || 3600) * 1000;
  return cachedToken;
}
function databaseUrl() {
  const url = process.env.FIREBASE_DATABASE_URL || "";
  if (!/^https:\/\/.+firebasedatabase\.app$/.test(url.replace(/\/$/, "")) && !/^https:\/\/.+firebaseio\.com$/.test(url.replace(/\/$/, ""))) throw new Error("Set FIREBASE_DATABASE_URL in Vercel.");
  return url.replace(/\/$/, "");
}
async function db(path, method, value) {
  const token = await accessToken();
  const response = await fetch(databaseUrl() + "/" + path + ".json", {
    method,
    headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" },
    ...(value === undefined ? {} : { body: JSON.stringify(value) })
  });
  const text = await response.text();
  let data = null; try { data = text ? JSON.parse(text) : null; } catch {}
  if (!response.ok) throw new Error("Firebase Realtime Database request failed (" + response.status + ").");
  return data;
}
function secretMatches(value) {
  const expected = process.env.API_KEY_ADMIN_SECRET || "";
  if (!expected || typeof value !== "string") return false;
  const a = Buffer.from(value), b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") { res.setHeader("Allow", "POST"); return json(res, 405, { error: "Use POST." }); }
  let body;
  try { body = typeof req.body === "object" && req.body !== null ? req.body : JSON.parse(req.body || "{}"); }
  catch { return json(res, 400, { error: "Invalid JSON." }); }
  if (!secretMatches(body.adminSecret)) return json(res, 401, { error: "Admin authorization failed." });
  const action = body.action;
  try {
    if (action === "create") {
      const label = String(body.label || "My project").trim().slice(0, 64) || "My project";
      const key = "sk-shakil-" + crypto.randomBytes(32).toString("base64url");
      const hash = crypto.createHash("sha256").update(key).digest("hex");
      const record = { label, prefix: key.slice(0, 18), createdAt: new Date().toISOString(), revoked: false };
      await db("shakilApiKeys/" + hash, "PUT", record);
      return json(res, 200, { key, record, warning: "Copy this key now. It will not be shown again." });
    }
    if (action === "list") {
      const records = await db("shakilApiKeys", "GET");
      const keys = Object.entries(records || {}).map(([id, record]) => ({ id, ...record })).sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
      return json(res, 200, { keys });
    }
    if (action === "revoke") {
      const id = String(body.id || "");
      if (!/^[a-f0-9]{64}$/.test(id)) return json(res, 400, { error: "Invalid key ID." });
      const current = await db("shakilApiKeys/" + id, "GET");
      if (!current) return json(res, 404, { error: "API key not found." });
      await db("shakilApiKeys/" + id, "PATCH", { revoked: true, revokedAt: new Date().toISOString() });
      return json(res, 200, { ok: true });
    }
    return json(res, 400, { error: "Unknown action." });
  } catch (error) {
    console.error("Shakil API key manager:", error?.message || error);
    return json(res, 503, { error: error.message || "API key manager is not configured." });
  }
};
