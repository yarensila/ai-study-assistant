// Minimal AI-powered text summarizer backend (Express + OpenAI)
// POST /api/summarize with JSON: { "text": "..." }
// Responds with JSON:
// { "title": "...", "summary": "...", "bullets": ["...","...","..."], "questions": ["...","...","..."] }

require("dotenv").config();

const path = require("path");
const express = require("express");
const { OpenAI } = require("openai");

const app = express();
const PORT = process.env.PORT || 3000;

// Parse JSON request bodies (keep this small; textarea content can be large)
app.use(express.json({ limit: "1mb" }));

// Serve the static frontend from /public
app.use(express.static(path.join(__dirname, "public")));

// Explicitly serve the UI at "/"
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.post("/api/summarize", async (req, res) => {
  try {
    const text = (req.body && typeof req.body.text === "string" ? req.body.text : "").trim();

    if (!text) {
      return res.status(400).json({ error: "Please paste some text to summarize." });
    }

    // Hard cap to avoid extremely large prompts
    if (text.length > 12000) {
      return res.status(400).json({ error: "Text is too long. Please paste up to 12,000 characters." });
    }

    const fallbackSummarize = (inputText) => {
      // Lightweight, deterministic-ish fallback that keeps the app working offline.
      const stopwords = new Set([
        "a",
        "an",
        "the",
        "and",
        "or",
        "but",
        "if",
        "then",
        "else",
        "when",
        "at",
        "by",
        "from",
        "in",
        "for",
        "with",
        "on",
        "to",
        "of",
        "as",
        "is",
        "are",
        "was",
        "were",
        "be",
        "been",
        "being",
        "it",
        "its",
        "this",
        "that",
        "these",
        "those",
        "you",
        "your",
        "we",
        "our",
        "they",
        "their",
        "he",
        "she",
        "him",
        "her",
        "them",
        "not",
        "no",
        "yes",
        "can",
        "could",
        "should",
        "would",
        "may",
        "might",
        "do",
        "does",
        "did",
        "done",
        "will",
        "just",
        "than",
        "too",
        "very",
        "also",
        "into",
        "over",
        "under",
        "about",
        "because",
        "while",
        "such",
        "what",
        "why",
        "how",
        "which",
      ]);

      const normalized = inputText.replace(/\s+/g, " ").trim();

      const sentences =
        normalized.match(/[^.!?]+[.!?]+|[^.!?]+$/g)?.map((s) => s.trim()).filter((s) => s.length >= 10) || [];

      const words = (normalized.match(/[A-Za-z0-9]+/g) || [])
        .map((w) => w.toLowerCase())
        .filter((w) => w.length >= 3 && !stopwords.has(w));

      const freq = new Map();
      for (const w of words) freq.set(w, (freq.get(w) || 0) + 1);

      const sortedKeywords = [...freq.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 8)
        .map(([w]) => w);

      const title = (() => {
        const kw1 = sortedKeywords[0];
        const kw2 = sortedKeywords[1];
        if (!kw1) return "Untitled";

        const cap = (w) => (w ? w[0].toUpperCase() + w.slice(1) : w);

        // Keep it academic, short, and <= 6 words.
        const candidate = kw2
          ? `The Role of ${cap(kw1)} and ${cap(kw2)}`
          : `Foundations of ${cap(kw1)}`;

        const words = candidate.split(/\s+/).filter(Boolean);
        return words.length > 6 ? words.slice(0, 6).join(" ") : candidate;
      })();

      const summary = (() => {
        if (sentences.length) {
          // Build a 2-3 sentence summary from the start.
          const chosen = [];
          for (const s of sentences) {
            if (chosen.length >= 3) break;
            // Prefer "informational" sentences.
            if (s.length < 25 && chosen.length >= 1) continue;
            chosen.push(s);
          }
          // Ensure at least 2 sentences when possible.
          if (chosen.length === 1 && sentences.length >= 2) chosen.push(sentences[1]);
          const out = chosen.join(" ").replace(/\s+/g, " ").trim();
          return out.length > 520 ? out.slice(0, 517) + "..." : out;
        }
        const out = normalized.length > 520 ? normalized.slice(0, 517) + "..." : normalized;
        // Add a period if it looks like a paragraph.
        return out.endsWith(".") || out.endsWith("!") || out.endsWith("?") ? out : `${out}.`;
      })();

      const bullets = (() => {
        if (!sentences.length) {
          const fallbackKeywords = sortedKeywords.slice(0, 3);
          const b = fallbackKeywords.map((k) => `Key idea: ${k}`);
          while (b.length < 3) b.push("Key idea from the text");
          return b.slice(0, 3);
        }

        const topKeywords = sortedKeywords.slice(0, 6);

        const scoreSentence = (s) => {
          let score = 0;
          const stoks = (s.toLowerCase().match(/[A-Za-z0-9]+/g) || []).filter((w) => w.length >= 3);
          for (const tok of stoks) {
            if (!topKeywords.includes(tok)) continue;
            score += freq.get(tok) || 0;
          }
          return score;
        };

        const ranked = sentences
          .map((s) => ({ s, score: scoreSentence(s) }))
          .sort((a, b) => b.score - a.score);

        const picked = [];
        for (const item of ranked) {
          if (picked.length >= 3) break;
          const candidate = item.s;
          if (candidate.length < 20) continue;
          const alreadyHas = picked.some((p) => p.toLowerCase() === candidate.toLowerCase());
          if (alreadyHas) continue;
          picked.push(candidate);
        }

        // If scoring didn't pick anything good, just take the first few sentences.
        if (picked.length < 3) {
          for (const s of sentences) {
            if (picked.length >= 3) break;
            if (picked.includes(s)) continue;
            picked.push(s);
          }
        }

        const out = picked.slice(0, 3).map((b) => {
          const trimmed = b.replace(/\s+/g, " ").trim();
          if (trimmed.length <= 160) return trimmed;
          const cut = trimmed.slice(0, 157);
          const lastSpace = cut.lastIndexOf(" ");
          return (lastSpace > 40 ? cut.slice(0, lastSpace) : cut) + "...";
        });

        return out.length === 3 ? out : out.concat(["Key idea from the text", "Key idea from the text"]).slice(0, 3);
      })();

      const questions = (() => {
        const kw1 = sortedKeywords[0] || "the topic";
        const kw2 = sortedKeywords[1] || sortedKeywords[2] || kw1;
        const kw3 = sortedKeywords[2] || sortedKeywords[1] || kw2;
        const cap = (w) => (w ? w[0].toUpperCase() + w.slice(1) : w);

        // Tie questions directly to extracted keywords.
        return [
          `In the passage, how is ${cap(kw1)} characterized or defined?`,
          `According to the passage, what relationship does ${cap(kw1)} have with ${cap(kw2)}?`,
          `Using the passage's ideas, create an example applying ${cap(kw1)} together with ${cap(kw3)}.`,
        ].slice(0, 3);
      })();

      return {
        mode: "fallback",
        title,
        summary,
        bullets,
        questions,
      };
    };

    // Try OpenAI normally first. On any failure, fall back to local logic.
    try {
      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) {
        throw new Error(
          "Missing OPENAI_API_KEY. Add it to a .env file (or your environment) and restart the server."
        );
      }

      const client = new OpenAI({ apiKey });
      const model = process.env.OPENAI_MODEL || "gpt-4o-mini";

      // Ask the model for STRICT JSON so the frontend can render predictably.
      const userPrompt = `Summarize the text below.

Return ONLY valid JSON (no markdown) with this exact shape:
{
  "title": "string",
  "summary": "string",
  "bullets": ["string", "string", "string"],
  "questions": ["string", "string", "string"]
}

Rules:
- "title" should be a short title suggestion (max ~12 words).
- "summary" should be 1-2 short sentences.
- "bullets" must contain exactly 3 concise bullet points.
- "questions" must contain exactly 3 exam-style questions based on the input text.
- Each question should be a complete question in string form.`;
      const completion = await client.chat.completions.create({
        model,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: "You are a helpful assistant that outputs strict JSON." },
          { role: "user", content: `${userPrompt}\n\nText:\n\"\"\"\n${text}\n\"\"\"` },
        ],
        // Keep responses concise
        temperature: 0.3,
      });

      const content = completion?.choices?.[0]?.message?.content;
      const data = JSON.parse(content || "{}");

      if (
        !data ||
        typeof data.title !== "string" ||
        typeof data.summary !== "string" ||
        !Array.isArray(data.bullets) ||
        data.bullets.length !== 3 ||
        !Array.isArray(data.questions) ||
        data.questions.length !== 3
      ) {
        throw new Error("Model returned an unexpected format.");
      }

      return res.json({
        title: data.title.trim(),
        summary: data.summary.trim(),
        bullets: data.bullets.map((b) => String(b).trim()).slice(0, 3),
        questions: data.questions.map((q) => String(q).trim()).slice(0, 3),
      });
    } catch (openAiErr) {
      // Any OpenAI failure (quota, network, invalid JSON) should not break the UI.
      console.error("OpenAI failed; using fallback:", openAiErr);
      const fb = fallbackSummarize(text);
      return res.json(fb);
    }
  } catch (err) {
    console.error("Summarize error:", err);
    res.status(500).json({
      error: "Failed to generate summary.",
      details: err?.message || String(err),
    });
  }
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});

