import { CSRF_COOKIE } from "../lib/cookies.js";

const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

export function requireCsrf(req, res, next) {
  if (process.env.NODE_ENV === "test") {
    return next();
  }

  // Bearer-token requests are not vulnerable to browser CSRF.
  const authHeader = String(req.headers.authorization || "");
  if (authHeader.startsWith("Bearer ")) {
    return next();
  }

  if (!MUTATING_METHODS.has(req.method)) {
    return next();
  }

  const cookieToken = req.cookies?.[CSRF_COOKIE];
  const headerToken = req.headers["x-csrf-token"];

  if (!cookieToken || !headerToken || cookieToken !== headerToken) {
    return res.status(403).json({ error: "csrf token validation failed" });
  }

  return next();
}
