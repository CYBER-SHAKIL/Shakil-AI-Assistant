const DEFAULT_MODEL = process.env.OPENAI_CHAT_MODEL || "gpt-6-luna";
const OWNER_PROMPT = "You are Shakil GPT, created and owned by Shakil. Reply primarily in natural, friendly, clear Bengali (বাংলা). Understand Bangla-English mixed messages and answer in Bengali unless the user explicitly asks for another language. If the user says they do not understand, explain again fully in simple Bengali with examples. When asked who created you, who owns you, or who your developer is, say your creator/owner is Shakil. Do not invent private details about Shakil. Be conversational and warm but honest, concise when appropriate, detailed when needed, and admit uncertainty. Never claim to have performed actions you did not perform.";
const ALLOWED_MODELS = new Set(["gpt-6-luna", "gpt-6.1-sol", "gpt-6-astra"]);
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
    .filter(m => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
    .slice(-30).map(m => ({ role: m.role, content: m.content.slice(0, 12000) }));
  if (!messages.length || !messages.some(m => m.role === "user")) return json(res, 400, { error: "At least one user message is required." });
  const auth = String(req.headers.authorization || "");
  const userKey = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  const apiKey = userKey || process.env.OPENAI_API_KEY;
  if (!apiKey) return json(res, 503, { error: "AI backend is not configured. Add OPENAI_API_KEY in Vercel Environment Variables." });
  const model = ALLOWED_MODELS.has(body.model) ? body.model : DEFAULT_MODEL;
  try {
    const upstream = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { Authorization: "Bearer " + apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        instructions: OWNER_PROMPT,
        input: messages,
        stream: body.stream === true,
        store: false,
        max_output_tokens: 1800
      })
    });
    if (!upstream.ok) {
      const detail = (await upstream.text()).slice(0, 900);
      return json(res, upstream.status, { error: "OpenAI API request failed.", detail });
    }
    if (body.stream !== true) {
      const data = await upstream.json();
      const text = (data.output || []).flatMap(item => item.content || []).filter(part => part.type === "output_text").map(part => part.text).join("");
      return json(res, 200, { reply: text, id: data.id, model: data.model });
    }
    res.statusCode = 200;
    res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    const reader = upstream.body.getReader();
    const decoder = new TextDecoder();
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
          if (event.type === "response.output_text.delta" && typeof event.delta === "string") emit(event.delta);
          if (event.type === "response.failed" || event.type === "error") {
            const message = event.response?.error?.message || event.error?.message || "OpenAI response failed.";
            emit("\n\n" + "দুঃখিত, উত্তর তৈরি করতে সমস্যা হয়েছে: " + message);
          }
        }
      }
    } finally {
      try { reader.releaseLock(); } catch {}
      res.write("data: [DONE]\n\n");
      res.end();
    }
  } catch (err) {
    console.error("OpenAI Responses API error:", err?.message || err);
    if (!res.headersSent) return json(res, 502, { error: "OpenAI API-তে সংযোগ করা যায়নি। API key, model access এবং billing পরীক্ষা করো।" });
    res.end();
  }
};
