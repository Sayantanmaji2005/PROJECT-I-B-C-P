import { verifyAccessToken } from "../lib/auth.js";
import { ACCESS_COOKIE } from "../lib/cookies.js";

function extractToken(req) {
  const header = req.headers.authorization || "";
  const [scheme, token] = header.split(" ");
  if (scheme === "Bearer" && token) {
    return token;
  }

  return req.cookies?.[ACCESS_COOKIE] || null;
}

export function requireAuth(req, res, next) {
  const token = extractToken(req);

  if (!token) {
    return res.status(401).json({ error: "authentication required" });
  }

  try {
    req.user = verifyAccessToken(token);
    return next();
  } catch (_error) {
    return res.status(401).json({ error: "invalid or expired token" });
  }
}

export function requireRoles(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: "forbidden" });
    }
    return next();
  };
}
