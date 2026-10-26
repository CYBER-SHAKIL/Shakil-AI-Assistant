const DEFAULT_MODEL = process.env.OPENAI_IMAGE_MODEL || "gpt-image-2.5-flare";
const windows = new Map();
function limited(ip) {
  const now = Date.now(), old = windows.get(ip);
  if (!old || now - old.start > 60_000) { windows.set(ip, { start: now, count: 1 }); return false; }
  old.count++;
  return old.count > 5;
}
function json(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(body));
}
module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") { res.setHeader("Allow", "POST"); return json(res, 405, { error: "Use POST for image generation." }); }
  const ip = String(req.headers["x-forwarded-for"] || req.socket?.remoteAddress || "unknown").split(",")[0].trim();
  if (limited(ip)) return json(res, 429, { error: "অনেকগুলো ছবি তৈরির অনুরোধ হয়েছে। এক মিনিট পরে চেষ্টা করো।" });
  let body;
  try { body = typeof req.body === "object" && req.body !== null ? req.body : JSON.parse(req.body || "{}"); }
  catch { return json(res, 400, { error: "Invalid JSON request body." }); }
  const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
  if (!prompt || prompt.length > 4000) return json(res, 400, { error: "prompt is required and must be under 4000 characters." });
  const auth = String(req.headers.authorization || "");
  const userKey = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  const apiKey = userKey || process.env.OPENAI_API_KEY;
  if (!apiKey) return json(res, 503, { error: "AI backend is not configured. Add OPENAI_API_KEY in Vercel Environment Variables." });
  const allowed = new Set(["gpt-image-2.5-flare", "gpt-image-2.5-sunburst", "gpt-image-2"]);
  const model = allowed.has(body.model) ? body.model : DEFAULT_MODEL;
  try {
    const upstream = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: { Authorization: "Bearer " + apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({ model, prompt, size: "1024x1024", quality: "medium", output_format: "png", n: 1 })
    });
    const data = await upstream.json().catch(() => ({}));
    if (!upstream.ok) return json(res, upstream.status, { error: "OpenAI image generation failed.", detail: String(data?.error?.message || "Check API key, image model access, organization verification, and billing.").slice(0, 800) });
    const imageBase64 = data?.data?.[0]?.b64_json;
    if (!imageBase64) return json(res, 502, { error: "OpenAI did not return image data." });
    return json(res, 200, { imageBase64, mimeType: "image/png", caption: "তোমার তৈরি করা ছবি" });
  } catch (err) {
    console.error("OpenAI image API error:", err?.message || err);
    return json(res, 502, { error: "OpenAI image service-এ সংযোগ করা যায়নি। API key ও billing পরীক্ষা করো।" });
  }
};
