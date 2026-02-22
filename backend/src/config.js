import dotenv from "dotenv";

dotenv.config();

export const PORT = Number(process.env.PORT || 4000);
export const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-me";
export const ACCESS_TOKEN_TTL = process.env.ACCESS_TOKEN_TTL || "15m";
export const REFRESH_TOKEN_TTL_DAYS = Number(process.env.REFRESH_TOKEN_TTL_DAYS || 30);
export const CORS_ORIGIN = (process.env.CORS_ORIGIN || "http://localhost:5173")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);
export const AUTH_RATE_LIMIT_WINDOW_MS = Number(process.env.AUTH_RATE_LIMIT_WINDOW_MS || 10 * 60 * 1000);
export const AUTH_RATE_LIMIT_MAX = Number(process.env.AUTH_RATE_LIMIT_MAX || 50);
export const API_RATE_LIMIT_WINDOW_MS = Number(process.env.API_RATE_LIMIT_WINDOW_MS || 60 * 1000);
export const API_RATE_LIMIT_MAX = Number(process.env.API_RATE_LIMIT_MAX || 300);
export const LOG_FORMAT = process.env.LOG_FORMAT || "dev";

export const COOKIE_DOMAIN = process.env.COOKIE_DOMAIN || undefined;
export const COOKIE_SECURE = String(process.env.COOKIE_SECURE || "false").toLowerCase() === "true";
export const COOKIE_SAME_SITE = process.env.COOKIE_SAME_SITE || "lax";
export const ACCESS_COOKIE_MAX_AGE_MS = Number(process.env.ACCESS_COOKIE_MAX_AGE_MS || 15 * 60 * 1000);
export const REFRESH_COOKIE_MAX_AGE_MS = Number(process.env.REFRESH_COOKIE_MAX_AGE_MS || 30 * 24 * 60 * 60 * 1000);
export const TRUST_PROXY = String(process.env.TRUST_PROXY || "false").toLowerCase() === "true";
