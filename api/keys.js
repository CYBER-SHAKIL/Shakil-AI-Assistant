"use strict";
const crypto = require("node:crypto");
const { db } = require("./_lib/firebase");
const { json, parseBody, getClientIp, rateLimit } = require("./_lib/auth");

function secretMatches(value) {
  const expected = process.env.API_KEY_ADMIN_SECRET || "";
  if (!expected || typeof value !== "string") return false;
  const a = Buffer.from(value), b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control","no-store");
  if (req.method !== "POST") { res.setHeader("Allow","POST"); return json(res,405,{error:"Use POST."}); }
  const ip = getClientIp(req);
  const attempts = await rateLimit("admin-keys:ip:"+ip,10,600);
  if (attempts.limited) return json(res,429,{error:"অনেকবার ভুল চেষ্টা হয়েছে। ১০ মিনিট পরে আবার চেষ্টা করো।"});
  const parsed = parseBody(req, 32 * 1024);
  if (parsed.error) return json(res,parsed.status,{error:parsed.error});
  const body = parsed.body;
  if (!secretMatches(body.adminSecret)) return json(res,401,{error:"Admin authorization failed."});
  const action = body.action;
  try {
    if (action === "create") {
      const label = String(body.label || "My project").trim().slice(0,64) || "My project";
      const key = "sk-shakil-" + crypto.randomBytes(32).toString("base64url");
      const hash = crypto.createHash("sha256").update(key).digest("hex");
      const record = {label,prefix:key.slice(0,18),createdAt:new Date().toISOString(),revoked:false};
      await db("shakilApiKeys/"+hash,"PUT",record);
      return json(res,200,{key,record,warning:"Copy this key now. It will not be shown again."});
    }
    if (action === "list") {
      const records = await db("shakilApiKeys","GET");
      const keys = Object.entries(records || {}).map(([id,record])=>({id,...record})).sort((a,b)=>String(b.createdAt).localeCompare(String(a.createdAt)));
      return json(res,200,{keys});
    }
    if (action === "revoke") {
      const id = String(body.id || "");
      if (!/^[a-f0-9]{64}$/.test(id)) return json(res,400,{error:"Invalid key ID."});
      const current = await db("shakilApiKeys/"+id,"GET");
      if (!current) return json(res,404,{error:"API key not found."});
      await db("shakilApiKeys/"+id,"PATCH",{revoked:true,revokedAt:new Date().toISOString()});
      return json(res,200,{ok:true});
    }
    return json(res,400,{error:"Unknown action."});
  } catch (error) {
    console.error("Shakil API key manager:",error?.message || error);
    return json(res,503,{error:"API key manager is not configured. Check Firebase environment variables."});
  }
};
