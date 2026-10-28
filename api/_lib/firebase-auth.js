"use strict";
const crypto = require("node:crypto");
const { db } = require("./firebase");
let certCache = {until:0, keys:{}};
async function verifyFirebaseIdToken(req) {
  const h = String(req.headers.authorization || "");
  const m = /^Bearer\s+([^\s]+)$/i.exec(h);
  if (!m) return {ok:false,status:401,error:"Login required. Please sign in first."};
  const parts = m[1].split(".");
  if (parts.length !== 3) return {ok:false,status:401,error:"Invalid Firebase login token."};
  let header, payload, signature;
  try {
    header=JSON.parse(Buffer.from(parts[0],"base64url").toString("utf8"));
    payload=JSON.parse(Buffer.from(parts[1],"base64url").toString("utf8"));
    signature=Buffer.from(parts[2],"base64url");
  } catch { return {ok:false,status:401,error:"Invalid Firebase login token."}; }
  const projectId=String(process.env.FIREBASE_PROJECT_ID || "shakil-dev-pro").trim();
  if (header.alg!=="RS256" || !header.kid || payload.aud!==projectId ||
      payload.iss!=="https://securetoken.google.com/"+projectId ||
      typeof payload.sub!=="string" || !payload.sub || payload.sub.length>128 ||
      !Number.isFinite(payload.exp) || payload.exp<=Date.now()/1000 ||
      !Number.isFinite(payload.iat) || payload.iat>Date.now()/1000+60) {
    return {ok:false,status:401,error:"Firebase login expired or invalid. Sign in again."};
  }
  try {
    if (Date.now()>=certCache.until || !certCache.keys[header.kid]) {
      const r=await fetch("https://www.googleapis.com/service_accounts/v1/metadata/x509/securetoken@system.gserviceaccount.com",{signal:AbortSignal.timeout(5000)});
      if(!r.ok) throw new Error("Firebase public keys unavailable");
      const keys=await r.json();
      const cacheControl=r.headers.get("cache-control")||"";
      const maxAge=Number((cacheControl.match(/max-age=(\d+)/)||[])[1]||3600);
      certCache={keys,until:Date.now()+Math.min(maxAge,21600)*1000};
    }
    const cert=certCache.keys[header.kid];
    if(!cert) return {ok:false,status:401,error:"Firebase login token key is unknown."};
    const verifier=crypto.createVerify("RSA-SHA256");
    verifier.update(parts[0]+"."+parts[1]); verifier.end();
    if(!verifier.verify(cert,signature)) return {ok:false,status:401,error:"Firebase login token signature is invalid."};
    if(payload.email && typeof payload.email!=="string") return {ok:false,status:401,error:"Invalid account email."};
    return {ok:true,user:{uid:payload.sub,email:String(payload.email||"").toLowerCase(),emailVerified:payload.email_verified===true,name:String(payload.name||"").slice(0,120)}};
  } catch(e) {
    console.error("Firebase ID token verification failed:",e?.message||e);
    return {ok:false,status:503,error:"Authentication service temporarily unavailable. Try again."};
  }
}
function json(res,status,body){res.statusCode=status;res.setHeader("Content-Type","application/json; charset=utf-8");res.setHeader("Cache-Control","no-store");return res.end(JSON.stringify(body));}
function parseBody(req,limit=32768){let body;try{body=typeof req.body==="object"&&req.body!==null?req.body:JSON.parse(typeof req.body==="string"&&req.body?req.body:"{}");}catch{return {error:"Invalid JSON request body.",status:400};}if(Buffer.byteLength(JSON.stringify(body))>limit)return {error:"Request body too large.",status:413};return {body};}
function getClientIp(req){const x=String(req.headers["x-real-ip"]||req.headers["x-forwarded-for"]||"unknown").split(",")[0].trim();return x.slice(0,80)||"unknown";}
async function rateLimit(key,limit,seconds){const now=Date.now();global.__shakilAuthRate ||= new Map();const map=global.__shakilAuthRate;let v=map.get(key);if(!v||v.until<now)v={n:0,until:now+seconds*1000};v.n++;map.set(key,v);return {limited:v.n>limit};}
module.exports={verifyFirebaseIdToken,json,parseBody,getClientIp,rateLimit,db};