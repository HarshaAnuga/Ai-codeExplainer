import "dotenv/config";
import express from "express";
import cors from "cors";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import OpenAI from "openai";





const app = express();

const PORT = Number(process.env.PORT) || 3002;
const frontendUrl = (process.env.FRONTEND_URL || "")
.trim()
  .replace(/\/+$/, "");
console.log("CORS allowed origin:", frontendUrl);
const NEBIUS_API_KEY = process.env.NEBIUS_API_KEY;
const MODEL = process.env.NEBIUS_MODEL || "deepseek-ai/DeepSeek-V4-Pro";

if (!NEBIUS_API_KEY) {
  throw new Error("Missing NEBIUS_API_KEY in environment variables");
}

// If deployed behind a reverse proxy (e.g. Render, Railway, Nginx), enable this:
// app.set("trust proxy", 1);

app.use(helmet());



const allowedOrigins = [
  frontendUrl,
  "http://localhost:5173",
  "http://localhost:3000",
].filter(Boolean);

app.use(cors({
  origin: function (origin, callback) {
    // allow Postman / server-to-server (no origin)
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.log("Blocked origin:", origin);
      callback(new Error("Not allowed by CORS"));
    }
  },
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true,
}));

app.options("*", cors());

app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    message: {
      error: "Too many requests from this IP. Please try again later.",
    },
  })
);

app.use(express.json({ limit: "1mb" }));

const client = new OpenAI({
  baseURL: "https://api.tokenfactory.nebius.com/v1/",
  apiKey: NEBIUS_API_KEY,
});

app.post("/api/explain-code", async (req, res) => {
  try {
    const { code, language } = req.body ?? {};

    if (typeof code !== "string" || !code.trim()) {
      return res.status(400).json({
        error: "A non-empty code string is required.",
      });
    }

    if (code.length > 50_000) {
      return res.status(413).json({
        error: "Code is too large. Maximum allowed length is 50,000 characters.",
      });
    }

    const safeLanguage =
      typeof language === "string" && language.trim()
        ? language.trim()
        : "unknown language";

    const messages = [
      {
        role: "system",
        content:
          "You are a helpful programming tutor. Explain code accurately in simple, concise terms. Mention bugs, security concerns, and improvements when relevant.",
      },
      {
        role: "user",
        content: `Explain the following ${safeLanguage} code:

\`\`\`${safeLanguage}
${code}
\`\`\``,
      },
    ];

    const response = await client.chat.completions.create({
      model: MODEL,
      messages, // Fixed: do not use messages: []
      temperature: 0.17,
      max_tokens: 800,
    });

    const explanation = response.choices?.[0]?.message?.content?.trim();

    if (!explanation) {
      return res.status(502).json({
        error: "The AI service returned no explanation.",
      });
    }

    return res.json({
      explanation,
      language: safeLanguage,
    });
  } catch (err) {
    console.error("Code Explain API Error:", err);

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

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});