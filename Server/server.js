import "dotenv/config";
import express from "express";
import cors from "cors";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import OpenAI from "openai";

const app = express();
const PORT = Number(process.env.PORT) || 3002;
const frontendUrl = (process.env.FRONTEND_URL || "").trim().replace(/\/+$/, "");
const NEBIUS_API_KEY = process.env.NEBIUS_API_KEY;
const MODEL = process.env.NEBIUS_MODEL || "deepseek-ai/DeepSeek-V4-Pro";

if (!NEBIUS_API_KEY) {
  console.error("Missing NEBIUS_API_KEY");
  process.exit(1);
}

// Required on Render (and similar proxies) so rate-limit sees real client IPs
app.set("trust proxy", 1);

app.use(helmet());
app.use(express.json({ limit: "1mb" }));

const allowedOrigins = new Set(
  [frontendUrl, "http://localhost:5173", "http://localhost:3000"].filter(Boolean)
);

app.use(
  cors({
    origin(origin, cb) {
      if (!origin || allowedOrigins.has(origin)) return cb(null, true);
      console.warn("Blocked CORS origin:", origin);
      return cb(null, false); // do not throw — avoid 500 on preflight
    },
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  })
);

app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    message: { error: "Too many requests. Please try again later." },
    // Avoid ValidationError noise if proxy headers vary
    validate: { xForwardedForHeader: false },
  })
);

const client = new OpenAI({
  baseURL: "https://api.tokenfactory.nebius.com/v1/",
  apiKey: NEBIUS_API_KEY,
});

app.get("/health", (_req, res) => {
  res.status(200).json({ ok: true, uptime: process.uptime() });
});

app.post("/explain-code", async (req, res) => {
  try {
    const { code, language } = req.body ?? {};

    if (typeof code !== "string" || !code.trim()) {
      return res.status(400).json({ error: "A non-empty code string is required." });
    }
    if (code.length > 50_000) {
      return res.status(413).json({
        error: "Code is too large. Maximum allowed length is 50,000 characters.",
      });
    }

    const safeLanguage =
      typeof language === "string" && language.trim()
        ? language.trim().slice(0, 64)
        : "unknown language";

    const response = await client.chat.completions.create({
      model: MODEL,
      temperature: 0.17,
      max_tokens: 800,
      messages: [
        {
          role: "system",
          content:
            "You are a helpful programming tutor. Explain code accurately in simple, concise terms. Mention bugs, security concerns, and improvements when relevant.",
        },
        {
          role: "user",
          content: `Explain the following ${safeLanguage} code:\n\n\`\`\`${safeLanguage}\n${code}\n\`\`\``,
        },
      ],
    });

    const explanation = response.choices?.[0]?.message?.content?.trim();
    if (!explanation) {
      return res.status(502).json({ error: "The AI service returned no explanation." });
    }

    return res.json({ explanation, language: safeLanguage });
  } catch (err) {
    console.error("Code Explain API Error:", err?.message || err);
    const status =
      typeof err?.status === "number" && err.status >= 400 && err.status < 600
        ? err.status
        : 500;
    return res.status(status).json({
      error:
        status === 500
          ? "An unexpected server error occurred."
          : "Unable to generate a code explanation.",
    });
  }
});

// 404 + global error handlers (CORS rejects, JSON parse errors, etc.)
app.use((_req, res) => res.status(404).json({ error: "Not found." }));
app.use((err, _req, res, _next) => {
  console.error("Unhandled error:", err?.message || err);
  res.status(err?.status || 500).json({ error: "Server error." });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server listening on port ${PORT}`);
  console.log("CORS allowed origins:", [...allowedOrigins]);
});