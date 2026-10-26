const DEFAULT_MODEL = process.env.OPENROUTER_DEFAULT_MODEL || "google/gemma-4-31b-it:free";
const FALLBACK_MODEL = "openrouter/free";
const BASE_PROMPT = `তুমি Shakil AI Assistant, Shakil Dev-এর তৈরি একটি সহায়ক বাংলা AI Assistant।

সাধারণ নিয়ম:
1. সহজ, স্বাভাবিক বাংলায় অথবা প্রয়োজনমতো বাংলা-English mix করে উত্তর দেবে।
2. ব্যবহারকারী নিজের নাম জানতে চাইলে বলবে তার নাম Shakil।
3. তোমাকে কে তৈরি করেছে বা developer কে—জিজ্ঞেস করলে বলবে: “আমাকে Shakil Dev তৈরি করেছেন।”
4. নিজের পরিচয় Shakil AI Assistant হিসেবে দেবে।
5. প্রশ্নের উত্তর পরিষ্কার ও নির্ভুলভাবে দেবে; না জানলে ভুল তথ্য বানাবে না।
6. Coding প্রশ্নে কার্যকর code, প্রয়োজনীয় error handling এবং বাংলায় ব্যাখ্যা দেবে।
7. ছবি সংযুক্ত থাকলে দৃশ্যমান বিষয় বিশ্লেষণ করবে; নিশ্চিত নও এমন কিছু সত্য হিসেবে বলবে না।
8. OpenRouter API key বা অন্য কোনো secret প্রকাশ করবে না।
9. টুল ব্যবহার করলে শুধু অনুমোদিত calculator tool ব্যবহার করবে; arbitrary code, shell command বা বাইরের action চালাবে না।`;
const MODE_PROMPTS = {
  study: `\n\nStudy Assistant mode: শিক্ষকের মতো ধাপে ধাপে বোঝাবে, সহজ উদাহরণ দেবে, প্রয়োজন হলে শেষে ছোট practice question দেবে। ব্যবহারকারী স্পষ্টভাবে উত্তর চাইলে উত্তর দেবে, তবে শেখার প্রক্রিয়াও ব্যাখ্যা করবে।`,
  chat: `\n\nAI Chat mode: সাধারণ প্রশ্ন, coding, planning এবং সমস্যা সমাধানে সহায়তা করো।`
};
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
// A small arithmetic parser. No eval/Function and no access to the host environment.
function calculate(expression) {
  if (typeof expression !== "string" || !expression.trim() || expression.length > 160) throw new Error("expression must be 1–160 characters");
  const tokens = expression.match(/\d+(?:\.\d+)?|[()+\-*/%^]/g) || [];
  if (tokens.join("") !== expression.replace(/\s+/g, "")) throw new Error("Only numbers and + - * / % ^ parentheses are supported");
  let i = 0;
  function atom() {
    const t = tokens[i++];
    if (t === "+" || t === "-") { const n = atom(); return t === "-" ? -n : n; }
    if (t === "(") { const n = sum(); if (tokens[i++] !== ")") throw new Error("Missing closing parenthesis"); return n; }
    const n = Number(t);
    if (!t || !Number.isFinite(n)) throw new Error("Expected a number");
    return n;
  }
  function power() { let n = atom(); if (tokens[i] === "^") { i++; n = Math.pow(n, power()); } return n; }
  function product() {
    let n = power();
    while (["*", "/", "%"].includes(tokens[i])) {
      const op = tokens[i++], b = power();
      if ((op === "/" || op === "%") && b === 0) throw new Error("Cannot divide by zero");
      n = op === "*" ? n * b : op === "/" ? n / b : n % b;
    }
    return n;
  }
  function sum() {
    let n = product();
    while (tokens[i] === "+" || tokens[i] === "-") { const op = tokens[i++], b = product(); n = op === "+" ? n + b : n - b; }
    return n;
  }
  const result = sum();
  if (i !== tokens.length || !Number.isFinite(result)) throw new Error("Invalid or out-of-range expression");
  return String(Number(result.toPrecision(12)));
}
function executeTool(name, args) {
  if (name !== "calculator") return JSON.stringify({ error: "Tool not permitted" });
  try { return JSON.stringify({ result: calculate(args.expression) }); }
  catch (e) { return JSON.stringify({ error: e.message || "Invalid expression" }); }
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
  const model = requested === FALLBACK_MODEL || requested.endsWith(":free") ? requested : DEFAULT_MODEL;
  const mode = body.mode === "study" ? "study" : "chat";
  const upstreamMessages = [{ role: "system", content: BASE_PROMPT + MODE_PROMPTS[mode] }, ...messages.filter(m => m.role !== "system")];
  const tools = [{
    type: "function",
    function: {
      name: "calculator",
      description: "Calculate a basic arithmetic expression accurately. Use for arithmetic instead of mental calculation.",
      parameters: {
        type: "object",
        properties: { expression: { type: "string", description: "Arithmetic expression using numbers, parentheses, +, -, *, /, %, and ^, for example (12+8)*3" } },
        required: ["expression"],
        additionalProperties: false
      }
    }
  }];
  try {
    let conversation = upstreamMessages;
    let data = null;
    let activeModel = model;
    // Allow a maximum of three safe calculator tool calls per request.
    for (let turn = 0; turn < 4; turn++) {
      const payload = {
        model: activeModel,
        messages: conversation,
        stream: false,
        max_tokens: 1800,
        tools,
        tool_choice: "auto",
        ...(activeModel !== FALLBACK_MODEL ? { models: [activeModel, FALLBACK_MODEL], route: "fallback" } : {})
      };
      let upstream = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: "Bearer " + apiKey,
          "Content-Type": "application/json",
          "HTTP-Referer": process.env.APP_URL || "https://shakil-ai-assistant-lime.vercel.app",
          "X-Title": "Shakil AI Assistant"
        },
        body: JSON.stringify(payload)
      });
      if (!upstream.ok) {
        const detail = (await upstream.text()).slice(0, 900);
        // Some free models do not support function calling. Retry without tools.
        if (turn === 0 && (upstream.status === 400 || upstream.status === 422)) {
          const retryPayload = { ...payload, messages: upstreamMessages };
          delete retryPayload.tools; delete retryPayload.tool_choice;
          upstream = await fetch("https://openrouter.ai/api/v1/chat/completions", {
            method: "POST",
            headers: { Authorization: "Bearer " + apiKey, "Content-Type": "application/json", "HTTP-Referer": process.env.APP_URL || "https://shakil-ai-assistant-lime.vercel.app", "X-Title": "Shakil AI Assistant" },
            body: JSON.stringify(retryPayload)
          });
          if (!upstream.ok) return json(res, upstream.status, { error: "OpenRouter API request failed.", detail: (await upstream.text()).slice(0, 900) });
          data = await upstream.json();
          break;
        }
        return json(res, upstream.status, { error: "OpenRouter API request failed.", detail });
      }
      data = await upstream.json();
      const message = data.choices?.[0]?.message;
      const calls = Array.isArray(message?.tool_calls) ? message.tool_calls : [];
      if (!calls.length || turn === 3) break;
      conversation = [...conversation, { role: "assistant", content: message.content || null, tool_calls: calls }];
      for (const call of calls) {
        let args = {};
        try { args = JSON.parse(call.function?.arguments || "{}"); } catch {}
        const result = executeTool(call.function?.name, args);
        conversation.push({ role: "tool", tool_call_id: call.id, content: result });
      }
    }
    const answer = data?.choices?.[0]?.message?.content;
    if (typeof answer !== "string" || !answer.trim()) return json(res, 502, { error: "মডেল কোনো text উত্তর দেয়নি। অন্য free model নির্বাচন করে আবার চেষ্টা করো।" });
    if (body.stream !== true) return json(res, 200, { reply: answer, id: data.id, model: data.model || model });
    res.statusCode = 200;
    res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    // Send the completed answer as short SSE chunks for the existing streaming UI.
    for (let i = 0; i < answer.length; i += 32) {
      res.write("data: " + JSON.stringify({ choices: [{ delta: { content: answer.slice(i, i + 32) } }] }) + "\n\n");
    }
    res.write("data: [DONE]\n\n");
    return res.end();
  } catch (err) {
    console.error("OpenRouter API error:", err?.message || err);
    if (!res.headersSent) return json(res, 502, { error: "OpenRouter-এ সংযোগ করা যায়নি। API key, model availability এবং free limit পরীক্ষা করো।" });
    return res.end();
  }
};
