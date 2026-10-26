const DEFAULT_MODEL = process.env.OPENROUTER_DEFAULT_MODEL || "google/gemma-4-31b-it:free";
const FALLBACK_MODEL = "openrouter/free";
const OWNER_PROMPT = `তুমি Shakil AI Assistant, Shakil Dev-এর তৈরি একটি সহায়ক বাংলা AI Assistant।

নিয়ম:
1. সব সময় সহজ, স্বাভাবিক বাংলা অথবা প্রয়োজনমতো বাংলা-English mix করে উত্তর দেবে।
2. ব্যবহারকারী নিজের নাম জানতে চাইলে বলবে তার নাম Shakil।
3. তোমাকে কে তৈরি করেছে, কে developer—জিজ্ঞেস করলে বলবে: “আমাকে Shakil Dev তৈরি করেছেন।”
4. নিজের পরিচয় সব সময় Shakil AI Assistant হিসেবে দেবে।
5. Hi/Hello-র মতো greeting-এ স্বাভাবিকভাবে উত্তর দেবে।
6. প্রশ্নের উত্তর পরিষ্কার ও নির্ভুলভাবে দেওয়ার চেষ্টা করবে; না জানলে ভুল তথ্য বানাবে না।
7. Coding প্রশ্নে কার্যকর code এবং বাংলায় ব্যাখ্যা দেবে।
8. ছবি সংযুক্ত থাকলে ছবিতে যা দেখা যায় তা বিশ্লেষণ করবে; নিশ্চিত নও এমন কিছু অনুমান করে সত্য হিসেবে বলবে না।
9. OpenRouter, API key বা internal configuration সম্পর্কে গোপন তথ্য প্রকাশ করবে না।`;
const windows = new Map();
function limited(ip) {
  const now = Date.now(), old = windows.get(ip);
  if (!old || now - old.start > 60_000) { windows.set(ip, { start: now, count: 1 }); return false; }
  old.count++;
  return old.count > 20;
}
function json(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(body));
}
module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") { res.setHeader("Allow", "POST"); return json(res, 405, { error: "Use POST for chat requests." }); }
  const ip = String(req.headers["x-forwarded-for"] || req.socket?.remoteAddress || "unknown").split(",")[0].trim();
  if (limited(ip)) return json(res, 429, { error: "অনেকগুলো অনুরোধ হয়েছে। এক মিনিট পরে আবার চেষ্টা করো।" });
  let body;
  try { body = typeof req.body === "object" && req.body !== null ? req.body : JSON.parse(req.body || "{}"); }
  catch { return json(res, 400, { error: "Invalid JSON request body." }); }
  if (!Array.isArray(body.messages) || body.messages.length === 0 || body.messages.length > 40) return json(res, 400, { error: "messages must be a non-empty array with at most 40 items." });
  const messages = body.messages
    .filter(m => m && ["user", "assistant", "system"].includes(m.role) && (typeof m.content === "string" || Array.isArray(m.content)))
    .slice(-30).map(m => ({ role: m.role, content: typeof m.content === "string" ? m.content.slice(0, 12000) : m.content }));
  if (!messages.length || !messages.some(m => m.role === "user")) return json(res, 400, { error: "At least one user message is required." });
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) return json(res, 503, { error: "Vercel-এ OPENROUTER_API_KEY Environment Variable যোগ করতে হবে।" });
  const requested = typeof body.model === "string" ? body.model : DEFAULT_MODEL;
  // Only allow free model IDs, plus OpenRouter's free-model router.
  const model = requested === FALLBACK_MODEL || requested.endsWith(":free") ? requested : DEFAULT_MODEL;
  const upstreamMessages = [{ role: "system", content: OWNER_PROMPT }, ...messages.filter(m => m.role !== "system")];
  const payload = {
    model,
    messages: upstreamMessages,
    stream: body.stream === true,
    max_tokens: 1800,
    ...(model !== FALLBACK_MODEL ? { models: [model, FALLBACK_MODEL], route: "fallback" } : {})
  };
  try {
    const upstream = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: "Bearer " + apiKey,
        "Content-Type": "application/json",
        "HTTP-Referer": process.env.APP_URL || "https://shakil-ai-assistant.vercel.app",
        "X-Title": "Shakil AI Assistant"
      },
      body: JSON.stringify(payload)
    });
    if (!upstream.ok) {
      const detail = (await upstream.text()).slice(0, 900);
      return json(res, upstream.status, { error: "OpenRouter API request failed.", detail });
    }
    if (body.stream !== true) {
      const data = await upstream.json();
      return json(res, 200, { reply: data.choices?.[0]?.message?.content || "", id: data.id, model: data.model || model });
    }
    res.statusCode = 200;
    res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    const reader = upstream.body.getReader(), decoder = new TextDecoder();
    let buffer = "";
    const emit = value => res.write("data: " + JSON.stringify({ choices: [{ delta: { content: value } }] }) + "\n\n");
    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";
        for (const line of lines) {
          if (!line.startsWith("data:")) continue;
          const raw = line.slice(5).trim();
          if (!raw || raw === "[DONE]") continue;
          let event;
          try { event = JSON.parse(raw); } catch { continue; }
          const delta = event.choices?.[0]?.delta?.content;
          if (typeof delta === "string" && delta) emit(delta);
          else if (Array.isArray(delta)) for (const part of delta) if (part.type === "text" && part.text) emit(part.text);
          if (event.error) emit("\n\nদুঃখিত, উত্তর তৈরি করতে সমস্যা হয়েছে।");
        }
      }
    } finally {
      try { reader.releaseLock(); } catch {}
      res.write("data: [DONE]\n\n");
      res.end();
    }
  } catch (err) {
    console.error("OpenRouter API error:", err?.message || err);
    if (!res.headersSent) return json(res, 502, { error: "OpenRouter-এ সংযোগ করা যায়নি। API key, model availability এবং free limit পরীক্ষা করো।" });
    res.end();
  }
};
