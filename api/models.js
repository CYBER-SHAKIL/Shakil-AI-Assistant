module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  if (req.method !== "GET") { res.setHeader("Allow", "GET"); res.statusCode = 405; return res.end(JSON.stringify({ error: "Use GET." })); }
  if (!process.env.OPENROUTER_API_KEY) { res.statusCode = 503; return res.end(JSON.stringify({ error: "OpenRouter is not configured." })); }
  try {
    const response = await fetch("https://openrouter.ai/api/v1/models", {
      headers: { Authorization: "Bearer " + process.env.OPENROUTER_API_KEY, "HTTP-Referer": process.env.APP_URL || "https://shakil-ai-assistant.vercel.app", "X-Title": "Shakil AI Assistant" }
    });
    if (!response.ok) { res.statusCode = response.status; return res.end(JSON.stringify({ error: "Could not load model list." })); }
    const data = await response.json();
    const models = (data.data || []).filter(m => m.id === "openrouter/free" || (m.id.endsWith(":free") && Number(m.pricing?.prompt || 0) === 0 && Number(m.pricing?.completion || 0) === 0))
      .map(m => ({ id: m.id, name: m.name || m.id, vision: (m.architecture?.input_modalities || []).includes("image"), contextLength: m.context_length || null }))
      .sort((a, b) => a.id === "google/gemma-4-31b-it:free" ? -1 : b.id === "google/gemma-4-31b-it:free" ? 1 : a.id.localeCompare(b.id));
    if (!models.some(m => m.id === "openrouter/free")) models.push({ id: "openrouter/free", name: "OpenRouter Free Router", vision: true, contextLength: null });
    res.statusCode = 200; res.end(JSON.stringify({ models }));
  } catch (error) {
    console.error("OpenRouter models error:", error?.message || error);
    res.statusCode = 502; res.end(JSON.stringify({ error: "Unable to fetch free models." }));
  }
};
