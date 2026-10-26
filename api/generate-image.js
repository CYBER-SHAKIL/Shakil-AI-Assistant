const DEFAULT_MODEL = process.env.OPENROUTER_IMAGE_CHAT_MODEL || "openai/gpt-4o-mini";
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
  if (limited(ip)) return json(res, 429, { error: "Image rate limit reached. Please wait one minute." });
  let body;
  try { body = typeof req.body === "object" && req.body !== null ? req.body : JSON.parse(req.body || "{}"); }
  catch { return json(res, 400, { error: "Invalid JSON request body." }); }
  const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
  if (!prompt || prompt.length > 4000) return json(res, 400, { error: "prompt is required and must be under 4000 characters." });
  const auth = String(req.headers.authorization || "");
  const userKey = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  const apiKey = userKey || process.env.OPENROUTER_API_KEY;
  if (!apiKey) return json(res, 503, { error: "AI backend is not configured. Add OPENROUTER_API_KEY in Vercel Environment Variables." });
  const model = typeof body.model === "string" && /^[\w./:-]{1,150}$/.test(body.model) ? body.model : DEFAULT_MODEL;
  try {
    const upstream = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: "Bearer " + apiKey,
        "Content-Type": "application/json",
        "HTTP-Referer": process.env.APP_URL || "https://shakil-ai-assistant-lime.vercel.app",
        "X-Title": "Shakil GPT"
      },
      body: JSON.stringify({
        model,
        messages: [{
          role: "user",
          content: "Generate an image for this request. If it is an image request, use the image generation tool. User prompt: " + prompt
        }],
        tools: [{ type: "openrouter:image_generation" }],
        stream: false
      })
    });
    const data = await upstream.json().catch(() => ({}));
    if (!upstream.ok) return json(res, upstream.status, { error: "Image provider request failed.", detail: String(data?.error?.message || data?.message || "Check model support and API credits.").slice(0, 600) });
    const msg = data?.choices?.[0]?.message || {};
    const image = Array.isArray(msg.images) ? msg.images.find(x => x?.image_url?.url || x?.url) : null;
    const imageUrl = image?.image_url?.url || image?.url || data?.imageUrl || "";
    if (!imageUrl) {
      const content = typeof msg.content === "string" ? msg.content : "";
      return json(res, 502, { error: "The selected model did not return an image. Try a model that supports OpenRouter image generation.", detail: content.slice(0, 400) });
    }
    return json(res, 200, { imageUrl, caption: "আপনার তৈরি করা ছবিটি এখানে।" });
  } catch (err) {
    console.error("OpenRouter image error:", err?.message || err);
    return json(res, 502, { error: "Could not reach the image provider. Check your key, model, and billing." });
  }
};
