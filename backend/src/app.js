import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import cookieParser from "cookie-parser";
import rateLimit from "express-rate-limit";
import { randomUUID } from "node:crypto";
import { API_RATE_LIMIT_MAX, API_RATE_LIMIT_WINDOW_MS, CORS_ORIGIN, LOG_FORMAT, TRUST_PROXY } from "./config.js";
import { prisma } from "./lib/prisma.js";
import { errorHandler } from "./lib/http.js";
import authRoutes from "./routes/auth.js";
import campaignRoutes from "./routes/campaigns.js";
import matchRoutes from "./routes/matches.js";
import proposalRoutes from "./routes/proposals.js";
import userRoutes from "./routes/users.js";

export function createApp() {
  const app = express();

  if (TRUST_PROXY) {
    app.set("trust proxy", 1);
  }

  morgan.token("request-id", (req) => req.id);

  const logFormat =
    LOG_FORMAT === "json"
      ? (tokens, req, res) =>
          JSON.stringify({
            ts: new Date().toISOString(),
            requestId: tokens["request-id"](req, res),
            method: tokens.method(req, res),
            path: tokens.url(req, res),
            status: Number(tokens.status(req, res)),
            durationMs: Number(tokens["response-time"](req, res)),
            remoteAddr: tokens["remote-addr"](req, res)
          })
      : "dev";

  const apiLimiter = rateLimit({
    windowMs: API_RATE_LIMIT_WINDOW_MS,
    max: API_RATE_LIMIT_MAX,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "too many requests, try again later" }
  });

  app.use(helmet());
  app.use(cors({ origin: CORS_ORIGIN, credentials: true }));
  app.use((req, res, next) => {
    req.id = req.headers["x-request-id"] || randomUUID();
    res.setHeader("x-request-id", req.id);
    next();
  });
  app.use(morgan(logFormat));
  app.use(cookieParser());
  app.use(express.json({ limit: "1mb" }));

  app.get("/live", (_req, res) => {
    return res.json({ ok: true, service: "collab-platform-api", status: "live" });
  });

  app.get("/ready", async (_req, res) => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      return res.json({ ok: true, service: "collab-platform-api", status: "ready" });
    } catch (_error) {
      return res.status(503).json({ ok: false, service: "collab-platform-api", status: "not-ready" });
    }
  });

  app.get("/health", async (_req, res) => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      return res.json({ ok: true, service: "collab-platform-api", db: "connected" });
    } catch (_error) {
      return res.status(500).json({ ok: false, service: "collab-platform-api", db: "disconnected" });
    }
  });

  app.use("/auth", authRoutes);
  app.use("/api", apiLimiter);
  app.use("/api/campaigns", campaignRoutes);
  app.use("/api/matches", matchRoutes);
  app.use("/api/proposals", proposalRoutes);
  app.use("/api/users", userRoutes);

  app.use(errorHandler);

  return app;
}
