"use strict";
const { json, parseBody, getClientIp, rateLimit, verifyTurnstile, requireValidKey } = require("./_lib/auth");

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control","no-store");
  if (req.method !== "POST") { res.setHeader("Allow","POST"); return json(res,405,{error:"Use POST for image generation."}); }
  const ip = getClientIp(req);
  const parsed = parseBody(req, 3.7 * 1024 * 1024);
  if (parsed.error) return json(res,parsed.status,{error:parsed.error});
  const body = parsed.body;
  const keyAuth = await requireValidKey(req);
  if (keyAuth.required && !keyAuth.ok) return json(res,401,{error:"Invalid or revoked Shakil API key."});
  if (!keyAuth.required) {
    const challenge = await verifyTurnstile(req);
    if (!challenge.ok) return json(res,403,{error:"Cloudflare Turnstile verification failed. আবার যাচাই করে চেষ্টা করো।"});
  }
  const ipQuota = await rateLimit("image:daily:ip:"+ip,Number(process.env.IMAGE_DAILY_LIMIT_PER_IP)||5,86400);
  if (ipQuota.limited) return json(res,429,{error:"আজকের ছবি তৈরির limit শেষ। আগামীকাল আবার চেষ্টা করো।"});
  if (keyAuth.required) {
    const key = String(req.headers["x-shakil-api-key"] || req.headers.authorization || "").trim();
    const keyQuota = await rateLimit("image:daily:key:"+key,Number(process.env.IMAGE_DAILY_LIMIT_PER_KEY)||20,86400);
    if (keyQuota.limited) return json(res,429,{error:"এই API key-এর দৈনিক image limit শেষ হয়েছে।"});
  }
  const globalQuota = await rateLimit("image:daily:global",Number(process.env.IMAGE_GLOBAL_DAILY_LIMIT)||500,86400);
  if (globalQuota.limited) return json(res,429,{error:"আজকের image-generation service limit শেষ হয়েছে। পরে আবার চেষ্টা করো।"});
  const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
  if (!prompt || prompt.length > 1000) return json(res,400,{error:"prompt আবশ্যক এবং 1,000 অক্ষরের মধ্যে হতে হবে।"});
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return json(res,503,{error:"Image backend configured নয়। পরবর্তী batch-এ Cloudflare Workers AI যুক্ত হবে।"});
  const allowed = new Set(["gpt-image-2.5-flare","gpt-image-2.5-sunburst","gpt-image-2"]);
  const model = allowed.has(body.model) ? body.model : (process.env.OPENAI_IMAGE_MODEL || "gpt-image-2");
  try {
    const controller = new AbortController();
    const timer = setTimeout(()=>controller.abort(),25000);
    let upstream;
    try {
      upstream = await fetch("https://api.openai.com/v1/images/generations",{
        method:"POST",
        headers:{Authorization:"Bearer "+apiKey,"Content-Type":"application/json"},
        body:JSON.stringify({model,prompt,size:"1024x1024",quality:"medium",output_format:"png",n:1}),
        signal:controller.signal
      });
    } finally { clearTimeout(timer); }
    const data = await upstream.json().catch(()=>({}));
    if (!upstream.ok) return json(res,502,{error:"Image generation service failed.",detail:String(data?.error?.message || "Check the image provider configuration.").slice(0,300)});
    const imageBase64 = data?.data?.[0]?.b64_json;
    if (!imageBase64) return json(res,502,{error:"Image provider did not return image data."});
    return json(res,200,{imageBase64,mimeType:"image/png",caption:"তোমার তৈরি করা ছবি"});
  } catch (error) {
    console.error("Image API error:",error?.message || error);
    return json(res,502,{error:"Image service-এ সংযোগ করা যায়নি। পরে আবার চেষ্টা করো।"});
  }
};
