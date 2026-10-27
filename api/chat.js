const DEFAULT_MODEL = process.env.OPENROUTER_DEFAULT_MODEL || "google/gemma-4-31b-it:free";
const FALLBACK_MODEL = "openrouter/free";
const BASE_PROMPT = `তুমি Shakil AI Assistant, Shakil-এর তৈরি একটি সহায়ক AI Assistant।

ভাষা ও ভঙ্গি — সবচেয়ে গুরুত্বপূর্ণ:
1. ব্যবহারকারী বাংলা, English, Hindi বা অন্য যে ভাষাতেই লিখুক, উত্তর সবসময় স্বাভাবিক, পরিষ্কার বাংলায় দেবে।
2. প্রয়োজনে অল্প কিছু English technical word ব্যবহার করা যাবে। অকারণে Hindi, Chinese বা অন্য ভাষা মেশাবে না। ব্যবহারকারী স্পষ্টভাবে অনুবাদ চাইলে শুধু অনুবাদের অংশে চাওয়া ভাষা ব্যবহার করবে।
3. প্রতিটি উত্তরের শুরুতে “আমি Shakil AI Assistant” বলবে না। নিজের পরিচয় শুধু সাধারণ greeting-এর জবাবে একবার দেবে।
4. শুধু ব্যবহারকারী “hi”, “hello”, “হাই”, “হ্যালো”, “হেলো”, “আসসালামু আলাইকুম” বা অনুরূপ ছোট greeting দিলে উত্তর হবে: “হাই! আমি Shakil AI Assistant! 😊\n\nআমি আপনার সাহায্যের জন্য এখানে আছি। আমি কীভাবে আপনাকে সাহায্য করতে পারি?”
5. greeting ছাড়া অন্য কোনো প্রশ্নে সরাসরি প্রশ্নের উত্তর দেবে; পরিচয়, নাম বা স্বাগত বাক্য অযথা যোগ করবে না।
6. কখনো “আপনি Shakil বলেছেন, তাই...” বা এ ধরনের বানানো/অপ্রাসঙ্গিক বাক্য বলবে না।
7. ব্যবহারকারী সরাসরি নিজের নাম জানতে চাইলে বলবে “Shakil”; developer/creator জানতে চাইলে বলবে “Shakil”।
8. কথোপকথনের আগের বার্তাগুলো মনে রেখে উত্তর দেবে। ব্যবহারকারী “Kisu na”, “Na”, “Owh”, “hmm”, “🙄” বা অন্য ছোট/আবেগপূর্ণ উত্তর দিলে প্রসঙ্গ বুঝে স্বাভাবিক, সংক্ষিপ্ত উত্তর দেবে; প্রতিবার “আমি কীভাবে সাহায্য করতে পারি?” বলবে না।
9. ব্যবহারকারী “Tmr name ki?” বা “Tomar naam ki?” বললে “আমার নাম Shakil AI Assistant 😊” বলবে। “Tomake ke baniyeche?”, “Who made you?” বা “Tomake ke baniyese go” দিয়ে তোমার নির্মাতাকে বোঝালে উত্তর “আমাকে তৈরি করেছে Shakil 😊”। “Shakil ke?” বললে “Shakil হলো এই AI Assistant-এর নির্মাতা।” বলবে।
10. “Kisu na” / “কিছু না” হলে “আচ্ছা, ঠিক আছে 😄” এর মতো ছোট উত্তর দেবে। শুধু “Na” / “না” হলে আগের প্রসঙ্গ ধরে সংক্ষিপ্ত উত্তর দেবে, নতুন করে সাহায্য চাওয়ার প্রশ্ন করবে না।
11. তারিখ/সময় বা সপ্তাহের দিন জিজ্ঞেস না করলে নিজে থেকে তারিখ বলবে না।
12. উত্তর সুন্দরভাবে সাজাবে; দরকারে ছোট heading, bullet বা code block ব্যবহার করবে। অপ্রয়োজনীয় পুনরাবৃত্তি, লম্বা ভূমিকা এবং অসংলগ্ন কথা এড়াবে।
13. তথ্য সঠিক রাখবে; নিশ্চিত না হলে অনুমানকে সত্য হিসেবে বলবে না।
10. Coding প্রশ্নে কার্যকর code ও বাংলায় ব্যাখ্যা দেবে। পড়াশোনা/গণিতের প্রশ্নে ধাপে ধাপে বোঝাবে। ছবি সংযুক্ত থাকলে দৃশ্যমান বিষয় বিশ্লেষণ করবে।
11. OpenRouter API key বা অন্য কোনো secret প্রকাশ করবে না।
12. কেবল অনুমোদিত calculator tool ব্যবহার করবে; arbitrary code, shell command বা বাইরের action চালাবে না.\n13. তুমি সাধারণ প্রশ্ন, coding, পড়াশোনা, গণিত, সংযুক্ত ছবি বোঝা এবং অনুরোধ অনুযায়ী code file তৈরি করতে সাহায্য করতে পারো। Code block-এ Copy ও Download সুবিধা আছে; HTML code block-এ sandboxed Live preview থাকে। কথোপকথন Print থেকে PDF হিসেবে save করা যায়। কোনো কোড সত্যিকারের run/test করা হয়েছে বলে দাবি করবে না যদি না Live preview-তে ব্যবহারকারী নিজে চালায়।`;
// Mode selection is removed; infer the task from each user message.
const windows = new Map();
function limited(ip) {
  const now = Date.now(), old = windows.get(ip);
  if (!old || now - old.start > 60_000) { windows.set(ip, { start: now, count: 1 }); return false; }
  old.count++;
  return old.count > 20;
}
async function verifyShakilApiKey(key) {
  if (typeof key !== "string" || !key.startsWith("sk-shakil-")) return false;
  let account;
  try { account = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON || "{}"); } catch {}
  const dbUrl = String(process.env.FIREBASE_DATABASE_URL || "").replace(/\/$/, "");
  if (!account?.client_email || !account?.private_key || !dbUrl) return false;
  try {
    const now = Math.floor(Date.now() / 1000);
    const b64 = v => Buffer.from(v).toString("base64url");
    const unsigned = b64(JSON.stringify({alg:"RS256",typ:"JWT"}))+"."+b64(JSON.stringify({iss:account.client_email,scope:"https://www.googleapis.com/auth/firebase.database https://www.googleapis.com/auth/userinfo.email",aud:account.token_uri||"https://oauth2.googleapis.com/token",iat:now,exp:now+3600}));
    const signer = require("node:crypto").createSign("RSA-SHA256"); signer.update(unsigned); signer.end();
    const assertion = unsigned+"."+signer.sign(account.private_key,"base64url");
    const tokenResponse = await fetch(account.token_uri||"https://oauth2.googleapis.com/token",{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body:new URLSearchParams({grant_type:"urn:ietf:params:oauth:grant-type:jwt-bearer",assertion})});
    const tokenData = await tokenResponse.json();
    if (!tokenResponse.ok || !tokenData.access_token) return false;
    const hash = require("node:crypto").createHash("sha256").update(key).digest("hex");
    const response = await fetch(dbUrl+"/shakilApiKeys/"+hash+".json",{headers:{Authorization:"Bearer "+tokenData.access_token}});
    if (!response.ok) return false;
    const record = await response.json();
    return !!record && record.revoked !== true;
  } catch { return false; }
}
function json(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(body));
}
function respondText(req, res, text) {
  if (req.body?.stream !== true) return json(res, 200, { reply: text, model: "greeting" });
  res.statusCode = 200;
  res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  for (let i = 0; i < text.length; i += 32) {
    res.write("data: " + JSON.stringify({ choices: [{ delta: { content: text.slice(i, i + 32) } }] }) + "\n\n");
  }
  res.write("data: [DONE]\n\n");
  return res.end();
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
let autoModelCache = { at: 0, models: [] };
async function chooseAutoModel(messages) {
  try {
    if (Date.now() - autoModelCache.at > 300000 || !autoModelCache.models.length) {
      const response = await fetch("https://openrouter.ai/api/v1/models", { headers: { Authorization: "Bearer " + process.env.OPENROUTER_API_KEY, "HTTP-Referer": process.env.APP_URL || "https://shakil-ai-assistant-lime.vercel.app", "X-Title": "Shakil AI Assistant" } });
      if (!response.ok) return FALLBACK_MODEL;
      const data = await response.json();
      autoModelCache.models = (data.data || []).filter(m => m.id?.endsWith(":free") && Number(m.pricing?.prompt || 0) === 0 && Number(m.pricing?.completion || 0) === 0);
      autoModelCache.at = Date.now();
    }
    const latest = [...messages].reverse().find(m => m.role === "user");
    const content = latest?.content;
    const hasImage = Array.isArray(content) && content.some(part => part?.type === "image_url" || part?.image_url);
    const text = typeof content === "string" ? content : Array.isArray(content) ? content.filter(p => p?.type === "text").map(p => p.text || "").join(" ") : "";
    const coding = /(?:\b(code|coding|program|debug|bug|html|css|javascript|typescript|python|java|react|api|script|compile|function)\b|কোড|প্রোগ্রাম|ওয়েবসাইট|ওয়েবসাইট|বাগ|ডিবাগ)/i.test(text);
    const reasoning = /(?:\b(math|mathematics|solve|equation|proof|reason|physics|chemistry|biology|homework|study|explain|calculate)\b|গণিত|সমীকরণ|সমাধান|পড়াশোনা|পড়াশোনা|ব্যাখ্যা|হিসাব|বিজ্ঞান)/i.test(text);
    const score = model => {
      const id = String(model.id || "").toLowerCase();
      const vision = (model.architecture?.input_modalities || []).includes("image");
      if (hasImage) return vision ? 100 : -1000;
      if (coding) return /coder|codestral|starcoder|devstral/.test(id) ? 90 : /qwen|deepseek|gemma/.test(id) ? 35 : 0;
      if (reasoning) return /deepseek-r1|qwq|reason|qwen3|gemma-4/.test(id) ? 75 : /llama|mistral/.test(id) ? 20 : 0;
      return /gemma-4|qwen3|llama-4|mistral-small/.test(id) ? 55 : /qwen|gemma|llama/.test(id) ? 30 : 0;
    };
    const best = autoModelCache.models.map(model => ({ model, score: score(model) })).filter(x => x.score > 0).sort((a,b) => b.score-a.score)[0];
    return best?.model?.id || FALLBACK_MODEL;
  } catch { return FALLBACK_MODEL; }
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
  const latestUserMessage = messages.filter(m => m.role === "user").slice(-1)[0];
  const greeting = typeof latestUserMessage?.content === "string" ? latestUserMessage.content.trim().toLowerCase().replace(/[.!?。！؟]+$/g, "").replace(/\s+/g, " ") : "";
  if (/^(hi|hlw|hello|hey|হাই|হ্যালো|হেলো|হ্যালোও|আসসালামু আলাইকুম)$/.test(greeting)) {
    return respondText(req, res, "হাই! আমি Shakil AI Assistant! 😊\n\nআমি আপনার সাহায্যের জন্য এখানে আছি। আমি কীভাবে আপনাকে সাহায্য করতে পারি?");
  }
  const externalKey = req.headers["x-shakil-api-key"] || (String(req.headers.authorization || "").startsWith("Bearer sk-shakil-") ? String(req.headers.authorization).slice(7) : "");
  const origin = String(req.headers.origin || "");
  let isOwnWebsite = false;
  try { const host = new URL(origin).host; const appHost = new URL(process.env.APP_URL || "https://shakil-ai-assistant-lime.vercel.app").host; isOwnWebsite = host === appHost || host === "shakil-ai-assistant-lime.vercel.app" || host === "shakil-ai-assistant.vercel.app"; } catch {}
  if (!isOwnWebsite && !externalKey) return json(res, 401, { error: "A Shakil API key is required for external project requests." });
  if (externalKey && !(await verifyShakilApiKey(externalKey))) return json(res, 401, { error: "Invalid or revoked Shakil API key." });
  // Deterministic handling for common short Bengali/Banglish conversation turns.
  const latestText = typeof latestUserMessage?.content === "string" ? latestUserMessage.content.trim().toLowerCase().replace(/[!?.,。！？؟]+$/g, "").replace(/\s+/g, " ") : "";
  let quickReply = "";
  if (/^(tmr|tomar|তোমার)\s*(name|naam|নাম)\s*(ki|কী|কি)$/.test(latestText)) {
    quickReply = "আমার নাম Shakil AI Assistant 😊";
  } else if (/^(tomake|tumi|tmk|amke|তোমাকে|তুমি|আমাকে)\s*(ke|কে)\s*(baniyeche|baniyese|banayche|বানিয়েছে|বানিয়েছে|বানাইছে|তৈরি করেছে)?$/.test(latestText) || /^(who made you|who created you|amke ke baniyese go|tomake ke baniyese go)$/.test(latestText)) {
    quickReply = "আমাকে তৈরি করেছে Shakil 😊";
  } else if (/^(shakil ke|শাকিল কে)$/.test(latestText)) {
    quickReply = "Shakil হলো এই AI Assistant-এর নির্মাতা।";
  } else if (/^(kisu na|kichu na|কিছু না|কিছুই না|nothing)$/.test(latestText)) {
    quickReply = "আচ্ছা, ঠিক আছে 😄";
  } else if (/^(na|না|no)$/.test(latestText)) {
    quickReply = "আচ্ছা, ঠিক আছে 😊";
  }
  if (quickReply) return respondText(req, res, quickReply);
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) return json(res, 503, { error: "Vercel-এ OPENROUTER_API_KEY Environment Variable যোগ করতে হবে।" });
  const requested = typeof body.model === "string" ? body.model : DEFAULT_MODEL;
  const model = requested === FALLBACK_MODEL ? await chooseAutoModel(messages) : (requested.endsWith(":free") ? requested : DEFAULT_MODEL);
  const upstreamMessages = [{ role: "system", content: BASE_PROMPT }, ...messages.filter(m => m.role !== "system")];
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
    const candidates = [...new Set([
      model,
      ...(requested === FALLBACK_MODEL ? [] : [FALLBACK_MODEL]),
      "google/gemma-4-26b-a4b-it:free",
      "google/gemma-4-31b-it:free",
      "openrouter/free"
    ])];
    let lastFailure = null;
    let finalData = null;
    let activeModel = model;

    // Try each distinct free model in sequence. Empty responses, unsupported tool
    // calling, provider errors, and transient failures all trigger a fallback.
    for (const candidate of candidates) {
      activeModel = candidate;
      let candidateMessages = upstreamMessages;
      let candidateData = null;
      let candidateSucceeded = false;

      for (let attempt = 0; attempt < 2; attempt++) {
        const payload = {
          model: candidate,
          messages: candidateMessages,
          stream: false,
          max_tokens: 1800,
          ...(attempt === 0 ? { tools, tool_choice: "auto" } : {})
        };
        let upstream;
        try {
          upstream = await fetch("https://openrouter.ai/api/v1/chat/completions", {
            method: "POST",
            headers: {
              Authorization: "Bearer " + apiKey,
              "Content-Type": "application/json",
              "HTTP-Referer": process.env.APP_URL || "https://shakil-ai-assistant-lime.vercel.app",
              "X-Title": "Shakil AI Assistant"
            },
            body: JSON.stringify(payload)
          });
        } catch (e) {
          lastFailure = "OpenRouter-এ সংযোগ করা যায়নি।";
          break;
        }

        if (!upstream.ok) {
          lastFailure = "মডেল " + candidate + " অনুরোধটি সম্পন্ন করতে পারেনি (" + upstream.status + ").";
          // Some free models do not support function calling. Retry this model without tools.
          if (attempt === 0 && (upstream.status === 400 || upstream.status === 422)) continue;
          break;
        }

        try { candidateData = await upstream.json(); }
        catch { lastFailure = "মডেল থেকে সঠিক JSON উত্তর পাওয়া যায়নি।"; break; }

        const candidateMessage = candidateData?.choices?.[0]?.message;
        const candidateCalls = Array.isArray(candidateMessage?.tool_calls) ? candidateMessage.tool_calls : [];
        if (candidateCalls.length && attempt === 0) {
          let toolConversation = [...upstreamMessages, { role: "assistant", content: candidateMessage.content || null, tool_calls: candidateCalls }];
          for (const call of candidateCalls.slice(0, 3)) {
            let args = {};
            try { args = JSON.parse(call.function?.arguments || "{}"); } catch {}
            toolConversation.push({ role: "tool", tool_call_id: call.id, content: executeTool(call.function?.name, args) });
          }
          candidateMessages = toolConversation;
          // Make one follow-up call with tool results, without offering additional tools.
          continue;
        }

        const answer = candidateMessage?.content;
        if (typeof answer === "string" && answer.trim()) {
          finalData = candidateData;
          candidateSucceeded = true;
          break;
        }
        lastFailure = "মডেল কোনো text উত্তর দেয়নি; অন্য ফ্রি মডেল চেষ্টা করা হচ্ছে।";
        break;
      }

      if (candidateSucceeded) break;
    }

    const answer = finalData?.choices?.[0]?.message?.content;
    if (typeof answer !== "string" || !answer.trim()) {
      return json(res, 502, {
        error: "দুঃখিত, এই মুহূর্তে কোনো ফ্রি AI মডেল উত্তর দিতে পারছে না। কিছুক্ষণ পরে আবার চেষ্টা করো।",
        detail: lastFailure || "সব চেষ্টা করা মডেল থেকে খালি উত্তর এসেছে।"
      });
    }
    if (body.stream !== true) return json(res, 200, { reply: answer, id: finalData.id, model: finalData.model || activeModel });
    res.statusCode = 200;
    res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
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
