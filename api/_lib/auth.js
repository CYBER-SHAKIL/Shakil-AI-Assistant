"use strict";
const crypto = require("node:crypto");
const { verifyShakilApiKey } = require("./firebase");

const localWindows = new Map();
const BODY_LIMIT = 3.7 * 1024 * 1024;

function getClientIp(req) {
  const trusted = String(req.headers["x-real-ip"] || "").trim();
  if (trusted && trusted.length < 80 && !trusted.includes(",")) return trusted;
  const forwarded = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim();
  if (forwarded && forwarded.length < 80) return forwarded;
  return String(req.socket?.remoteAddress || "unknown").slice(0,80);
}
function json(res, status, body) {
  if (res.writableEnded) return;
  res.statusCode = status;
  res.setHeader("Content-Type","application/json; charset=utf-8");
  res.setHeader("Cache-Control","no-store");
  res.end(JSON.stringify(body));
}
function parseBody(req, limit=BODY_LIMIT) {
  let body;
  try {
    body = typeof req.body === "object" && req.body !== null ? req.body :
      JSON.parse(typeof req.body === "string" && req.body ? req.body : "{}");
  } catch { return {error:"Invalid JSON request body.",status:400}; }
  let size;
  try { size = Buffer.byteLength(JSON.stringify(body)); } catch { return {error:"Invalid request body.",status:400}; }
  if (size > limit) return {error:"অনুরোধের আকার অনেক বড়। ছোট করে আবার চেষ্টা করো।",status:413};
  return {body,size};
}
async function rateLimit(key, limit, windowSeconds) {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  const safeKey = "shakil:rl:" + crypto.createHash("sha256").update(String(key)).digest("hex");
  if (url && token) {
    try {
      const response = await fetch(url.replace(/\/$/,""), {
        method:"POST", headers:{Authorization:"Bearer "+token,"Content-Type":"application/json"},
        body:JSON.stringify(["INCR",safeKey])
      });
      if (!response.ok) throw new Error("Redis INCR failed");
      const data = await response.json();
      const count = Number(data.result);
      if (!Number.isFinite(count)) throw new Error("Invalid Redis count");
      if (count === 1) {
        await fetch(url.replace(/\/$/,""), {method:"POST",headers:{Authorization:"Bearer "+token,"Content-Type":"application/json"},body:JSON.stringify(["EXPIRE",safeKey,windowSeconds])});
      }
      return {limited:count>limit, count, persistent:true};
    } catch (error) {
      console.error("Upstash rate limit unavailable; using local fallback:", error?.message || error);
    }
  }
  const now = Date.now();
  let item = localWindows.get(safeKey);
  if (!item || now >= item.until) item = {count:0,until:now+windowSeconds*1000};
  item.count++;
  localWindows.set(safeKey,item);
  if (localWindows.size > 5000) {
    for (const [k,v] of localWindows) if (now >= v.until) localWindows.delete(k);
  }
  return {limited:item.count>limit,count:item.count,persistent:false};
}
async function verifyTurnstile(req) {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) return {ok:true,configured:false};
  const token = String(req.headers["cf-turnstile-response"] || req.headers["x-turnstile-token"] || "").trim();
  if (!token || token.length > 2048) return {ok:false,configured:true};
  const form = new URLSearchParams({secret,response:token});
  const ip = getClientIp(req);
  if (ip !== "unknown") form.set("remoteip",ip);
  try {
    const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify",{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body:form});
    const result = await response.json();
    if (!result.success) return {ok:false,configured:true};
    const appHost = (()=>{try{return new URL(process.env.APP_URL || "https://shakil-ai-assistant-lime.vercel.app").hostname;}catch{return "";}})();
    if (result.hostname && appHost && result.hostname !== appHost && !result.hostname.endsWith(".vercel.app")) return {ok:false,configured:true};
    return {ok:true,configured:true};
  } catch { return {ok:false,configured:true}; }
}
async function requireValidKey(req) {
  const key = String(req.headers["x-shakil-api-key"] || (String(req.headers.authorization || "").startsWith("Bearer sk-shakil-") ? String(req.headers.authorization).slice(7) : "")).trim();
  if (!key) return {ok:false,required:false};
  return {ok:await verifyShakilApiKey(key),required:true};
}
module.exports = { BODY_LIMIT, getClientIp, json, parseBody, rateLimit, verifyTurnstile, requireValidKey, verifyShakilApiKey };
