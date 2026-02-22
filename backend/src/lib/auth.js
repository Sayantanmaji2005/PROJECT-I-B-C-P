import crypto from "crypto";
import jwt from "jsonwebtoken";
import { ACCESS_TOKEN_TTL, JWT_SECRET } from "../config.js";

export function signAccessToken(user) {
  return jwt.sign(
    {
      sub: user.id,
      role: user.role,
      email: user.email
    },
    JWT_SECRET,
    { expiresIn: ACCESS_TOKEN_TTL }
  );
}

export function verifyAccessToken(token) {
  return jwt.verify(token, JWT_SECRET);
}

export function createRefreshToken() {
  return crypto.randomBytes(48).toString("hex");
}

export function hashRefreshToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}
