const DEFAULT_MODEL = process.env.OPENROUTER_CHAT_MODEL || "openai/gpt-4o-mini";
const OWNER_PROMPT = "You are Shakil GPT, created and owned by Shakil. Reply primarily in natural, clear Bengali (বাংলা). Understand Bangla-English mixed messages. If the user says they do not understand, explain again fully in simple Bengali. When asked who created you, who owns you, or who your developer is, say your creator/owner is Shakil. Do not invent private details about Shakil. Be helpful, accurate, and honest; admit uncertainty. Never claim to have performed an action you did not perform.";

const windows = new Map();
function limited(ip) {
  const now = Date.now();
  const old = windows.get(ip);
  if (!old || now - old.start > 60_000) {
    windows.set(ip, { start: now, count: 1 });
    return false;
  }
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
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return json(res, 405, { error: "Use POST for chat requests." });
  }
  const ip = String(req.headers["x-forwarded-for"] || req.socket?.remoteAddress || "unknown").split(",")[0].trim();
  if (limited(ip)) return json(res, 429, { error: "Too many requests. Please wait one minute and try again." });
  let body;
  try {
    body = typeof req.body === "object" && req.body !== null ? req.body : JSON.parse(req.body || "{}");
  } catch {
    return json(res, 400, { error: "Invalid JSON request body." });
  }
  if (!Array.isArray(body.messages) || body.messages.length === 0 || body.messages.length > 40) {
    return json(res, 400, { error: "messages must be a non-empty array with at most 40 items." });
  }
  const messages = body.messages
    .filter(m => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
    .slice(-30)
    .map(m => ({ role: m.role, content: m.content.slice(0, 12000) }));
  if (!messages.length || !messages.some(m => m.role === "user")) {
    return json(res, 400, { error: "At least one user message is required." });
  }
  const auth = String(req.headers.authorization || "");
  const userKey = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  const apiKey = userKey || process.env.OPENROUTER_API_KEY;
  if (!apiKey) return json(res, 503, { error: "AI backend is not configured. Add OPENROUTER_API_KEY in Vercel Environment Variables." });
  const model = typeof body.model === "string" && /^[\w./:-]{1,150}$/.test(body.model)
    ? body.model
    : DEFAULT_MODEL;
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
        messages: [{ role: "system", content: OWNER_PROMPT }, ...messages],
        stream: body.stream === true,
        temperature: 0.7,
        max_tokens: 1800
      })
    });
    if (!upstream.ok) {
      const detail = (await upstream.text()).slice(0, 700);
      return json(res, upstream.status, { error: "AI provider request failed.", detail });
    }
    const type = upstream.headers.get("content-type") || "";
    res.statusCode = 200;
    res.setHeader("Content-Type", type.includes("text/event-stream") ? "text/event-stream; charset=utf-8" : "application/json; charset=utf-8");
    res.setHeader("X-Accel-Buffering", "no");
    if (upstream.body && typeof upstream.body.pipe === "function") {
      upstream.body.pipe(res);
    } else if (upstream.body) {
      const reader = upstream.body.getReader();
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        res.write(Buffer.from(value));
      }
      res.end();
    } else {
      res.end(await upstream.text());
    }
  } catch (err) {
    console.error("OpenRouter chat error:", err?.message || err);
    if (!res.headersSent) return json(res, 502, { error: "Could not reach the AI provider. Check your key, model, and billing." });
    res.end();
  }
};
