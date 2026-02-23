import express from "express";
import bcrypt from "bcryptjs";
import rateLimit from "express-rate-limit";
import { prisma } from "../lib/prisma.js";
import { ApiError, asyncHandler } from "../lib/http.js";
import { createRefreshToken, hashRefreshToken, signAccessToken } from "../lib/auth.js";
import { AUTH_RATE_LIMIT_MAX, AUTH_RATE_LIMIT_WINDOW_MS, REFRESH_TOKEN_TTL_DAYS } from "../config.js";
import { createAuditLog } from "../lib/audit.js";
import { clearAuthCookies, createCsrfToken, REFRESH_COOKIE, setAuthCookies } from "../lib/cookies.js";
import { requireAuth } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { authLoginSchema, authSignupSchema } from "../validators/schemas.js";

const router = express.Router();

const authLimiter = rateLimit({
  windowMs: AUTH_RATE_LIMIT_WINDOW_MS,
  max: AUTH_RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "too many auth requests, try again later" }
});

function safeUser(user) {
  return { id: user.id, name: user.name, email: user.email, role: user.role };
}

function authResponse(user, accessToken, csrfToken) {
  return { user: safeUser(user), accessToken, csrfToken };
}

function refreshExpiryDate() {
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + REFRESH_TOKEN_TTL_DAYS);
  return expiresAt;
}

async function revokeAllActiveRefreshTokens(userId) {
  await prisma.refreshToken.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() }
  });
}

async function issueTokens(user) {
  const accessToken = signAccessToken(user);
  const refreshToken = createRefreshToken();

  await prisma.refreshToken.create({
    data: {
      tokenHash: hashRefreshToken(refreshToken),
      userId: user.id,
      expiresAt: refreshExpiryDate()
    }
  });

  return { accessToken, refreshToken };
}

router.post("/signup", authLimiter, validate(authSignupSchema), asyncHandler(async (req, res) => {
  const { name, email, password, role } = req.body;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) throw new ApiError(409, "email already in use");

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({ data: { name, email, passwordHash, role } });

  const tokens = await issueTokens(user);
  const csrfToken = createCsrfToken();
  setAuthCookies(res, tokens.accessToken, tokens.refreshToken, csrfToken);
  req.user = { sub: user.id, role: user.role, email: user.email };
  await createAuditLog(req, {
    action: "auth.signup",
    entityType: "user",
    entityId: user.id
  });

  return res.status(201).json(authResponse(user, tokens.accessToken, csrfToken));
}));

router.post("/login", authLimiter, validate(authLoginSchema), asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) throw new ApiError(401, "invalid credentials");

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) throw new ApiError(401, "invalid credentials");

  const tokens = await issueTokens(user);
  const csrfToken = createCsrfToken();
  setAuthCookies(res, tokens.accessToken, tokens.refreshToken, csrfToken);
  req.user = { sub: user.id, role: user.role, email: user.email };
  await createAuditLog(req, {
    action: "auth.login",
    entityType: "user",
    entityId: user.id
  });

  return res.json(authResponse(user, tokens.accessToken, csrfToken));
}));

router.post("/refresh", authLimiter, asyncHandler(async (req, res) => {
  const refreshCookie = req.cookies?.[REFRESH_COOKIE];
  if (!refreshCookie) {
    clearAuthCookies(res);
    throw new ApiError(401, "refresh token missing");
  }

  const tokenRecord = await prisma.refreshToken.findUnique({
    where: { tokenHash: hashRefreshToken(refreshCookie) },
    include: { user: true }
  });

  if (!tokenRecord) {
    clearAuthCookies(res);
    throw new ApiError(401, "invalid refresh token");
  }

  if (tokenRecord.revokedAt) {
    await revokeAllActiveRefreshTokens(tokenRecord.userId);
    clearAuthCookies(res);
    throw new ApiError(401, "refresh token reuse detected; please log in again");
  }

  if (tokenRecord.expiresAt <= new Date()) {
    await prisma.refreshToken.update({ where: { id: tokenRecord.id }, data: { revokedAt: new Date() } });
    clearAuthCookies(res);
    throw new ApiError(401, "refresh token expired");
  }

  const nextRefreshToken = createRefreshToken();
  const nextTokenRecord = await prisma.refreshToken.create({
    data: {
      tokenHash: hashRefreshToken(nextRefreshToken),
      userId: tokenRecord.userId,
      expiresAt: refreshExpiryDate()
    }
  });

  await prisma.refreshToken.update({
    where: { id: tokenRecord.id },
    data: { revokedAt: new Date(), replacedByToken: nextTokenRecord.id }
  });

  const accessToken = signAccessToken(tokenRecord.user);
  const csrfToken = createCsrfToken();
  setAuthCookies(res, accessToken, nextRefreshToken, csrfToken);

  req.user = { sub: tokenRecord.user.id, role: tokenRecord.user.role, email: tokenRecord.user.email };
  await createAuditLog(req, {
    action: "auth.refresh",
    entityType: "session",
    entityId: tokenRecord.user.id
  });

  return res.json({ ok: true, accessToken, csrfToken });
}));

router.post("/logout", requireAuth, asyncHandler(async (req, res) => {
  await revokeAllActiveRefreshTokens(Number(req.user.sub));
  clearAuthCookies(res);
  await createAuditLog(req, {
    action: "auth.logout",
    entityType: "user",
    entityId: req.user.sub
  });

  return res.json({ ok: true });
}));

router.get("/me", requireAuth, asyncHandler(async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: Number(req.user.sub) },
    select: { id: true, name: true, email: true, role: true, createdAt: true }
  });

  if (!user) throw new ApiError(404, "user not found");
  return res.json(user);
}));

export default router;
