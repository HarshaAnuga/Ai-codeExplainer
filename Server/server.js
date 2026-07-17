import "dotenv/config";
import express from "express";
import cors from "cors";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import OpenAI from "openai";

const app = express();

const PORT = Number(process.env.PORT) || 3002;
const NODE_ENV = process.env.NODE_ENV || "development";
const isProd = NODE_ENV === "production";

const frontendUrl = (process.env.FRONTEND_URL || "")
  .trim()
  .replace(/\/+$/, "");

const NEBIUS_API_KEY = process.env.NEBIUS_API_KEY;
const MODEL = process.env.NEBIUS_MODEL || "deepseek-ai/DeepSeek-V4-Pro";
const AI_TIMEOUT_MS = Number(process.env.AI_TIMEOUT_MS) || 45_000;
const MAX_CODE_LENGTH = Number(process.env.MAX_CODE_LENGTH) || 50_000;

if (!NEBIUS_API_KEY) {
  console.error("Missing NEBIUS_API_KEY in environment variables");
  process.exit(1);
}

// Required on Render / Railway / Nginx so req.ip and rate-limit work
if (process.env.TRUST_PROXY === "1" || isProd) {
  app.set("trust proxy", 1);
}

// ---------------------------------------------------------------------------
// Security & parsers
// ---------------------------------------------------------------------------
app.use(
  helmet({
    contentSecurityPolicy: false, // API-only; enable CSP on the frontend
    crossOriginResourcePolicy: { policy: "cross-origin" },
  })
);

app.use(express.json({ limit: "1mb" }));

// ---------------------------------------------------------------------------
// CORS
// ---------------------------------------------------------------------------
const allowedOrigins = [
  frontendUrl,
  "http://localhost:5173",
  "http://localhost:3000",
].filter(Boolean);

console.log("CORS allowed origins:", allowedOrigins);

const corsOptions = {
  origin(origin, callback) {
    // Postman / server-to-server / same-origin tools often send no Origin
    if (!origin || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    console.warn("Blocked CORS origin:", origin);
    return callback(null, false);
  },
  methods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Request-Id"],
  credentials: true,
  optionsSuccessStatus: 204,
};

app.use(cors(corsOptions));
app.options("*", cors(corsOptions));

// ---------------------------------------------------------------------------
// Rate limit (skip health)
// ---------------------------------------------------------------------------
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: Number(process.env.RATE_LIMIT_MAX) || 100,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: {
    error: "Too many requests from this IP. Please try again later.",
  },
  skip: (req) => req.path === "/health" || req.path === "/api/health",
});

app.use(limiter);

// Request id for logs / client correlation
app.use((req, res, next) => {
  const id = req.headers["x-request-id"] || randomUUID();
  req.requestId = id;
  res.setHeader("X-Request-Id", id);
  next();
});

// ---------------------------------------------------------------------------
// AI client
// ---------------------------------------------------------------------------
const client = new OpenAI({
  baseURL: "https://api.tokenfactory.nebius.com/v1/",
  apiKey: NEBIUS_API_KEY,
  timeout: AI_TIMEOUT_MS,
  maxRetries: 2,
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function sanitizeLanguage(language) {
  if (typeof language !== "string") return "unknown";
  const cleaned = language.trim().slice(0, 40);
  // Letters, numbers, spaces, + # . _ - only
  if (!/^[a-zA-Z0-9+#.\s_-]+$/.test(cleaned) || !cleaned) {
    return "unknown";
  }
  return cleaned;
}

function mapUpstreamStatus(err) {
  const status = err?.status ?? err?.response?.status;
  if (typeof status === "number" && status >= 400 && status < 600) {
    return status;
  }
  if (err?.name === "APIConnectionTimeoutError" || err?.code === "ETIMEDOUT") {
    return 504;
  }
  return 500;
}

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------
app.get("/health", (_req, res) => {
  res.status(200).json({
    status: "ok",
    uptime: process.uptime(),
    env: NODE_ENV,
  });
});

app.get("/api/health", (_req, res) => {
  res.status(200).json({ status: "ok" });
});

app.post("/api/explain-code", async (req, res) => {
  const requestId = req.requestId;

  try {
    const { code, language } = req.body ?? {};

    if (typeof code !== "string" || !code.trim()) {
      return res.status(400).json({
        error: "A non-empty code string is required.",
        requestId,
      });
    }

    if (code.length > MAX_CODE_LENGTH) {
      return res.status(413).json({
        error: `Code is too large. Maximum allowed length is ${MAX_CODE_LENGTH} characters.`,
        requestId,
      });
    }

    const safeLanguage = sanitizeLanguage(language);

    const messages = [
      {
        role: "system",
        content:
          "You are a helpful programming tutor. Explain code accurately in simple, concise terms. Mention bugs, security concerns, and improvements when relevant. Do not invent APIs or behavior that is not present in the code.",
      },
      {
        role: "user",
        content: `Explain the following ${safeLanguage} code:\n\n\`\`\`${safeLanguage}\n${code}\n\`\`\``,
      },
    ];

    const response = await client.chat.completions.create({
      model: MODEL,
      messages,
      temperature: 0.17,
      max_tokens: 800,
    });

    const explanation = response.choices?.[0]?.message?.content?.trim();

    if (!explanation) {
      return res.status(502).json({
        error: "The AI service returned no explanation.",
        requestId,
      });
    }

    return res.json({
      explanation,
      language: safeLanguage,
      requestId,
    });
  } catch (err) {
    console.error(`[${requestId}] Code Explain API Error:`, err);

    const status = mapUpstreamStatus(err);

    // Do not leak upstream messages in production
    const clientMessage =
      status === 429
        ? "AI rate limit exceeded. Please try again shortly."
        : status === 401 || status === 403
          ? "AI service authentication failed."
          : status === 504
            ? "AI service timed out. Please try again."
            : status === 500
              ? "An unexpected server error occurred."
              : "Unable to generate a code explanation.";

    return res.status(status >= 400 && status < 600 ? status : 500).json({
      error: clientMessage,
      requestId,
    });
  }
});

// 404
app.use((_req, res) => {
  res.status(404).json({ error: "Not found" });
});

// Central error handler (e.g. bad JSON body)
app.use((err, _req, res, _next) => {
  if (err?.type === "entity.parse.failed") {
    return res.status(400).json({ error: "Invalid JSON body." });
  }
  if (err?.type === "entity.too.large") {
    return res.status(413).json({ error: "Request body too large." });
  }
  console.error("Unhandled error:", err);
  return res.status(500).json({ error: "An unexpected server error occurred." });
});

// ---------------------------------------------------------------------------
// Start + graceful shutdown
// ---------------------------------------------------------------------------
const server = app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT} (${NODE_ENV})`);
  console.log(`Model: ${MODEL}`);
});