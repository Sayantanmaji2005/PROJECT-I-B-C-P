import {
  ACCESS_COOKIE_MAX_AGE_MS,
  COOKIE_DOMAIN,
  COOKIE_SAME_SITE,
  COOKIE_SECURE,
  REFRESH_COOKIE_MAX_AGE_MS
} from "../config.js";

export const ACCESS_COOKIE = "cp_access";
export const REFRESH_COOKIE = "cp_refresh";

function cookieBaseOptions(maxAge) {
  return {
    httpOnly: true,
    secure: COOKIE_SECURE,
    sameSite: COOKIE_SAME_SITE,
    domain: COOKIE_DOMAIN,
    path: "/",
    maxAge
  };
}

export function setAuthCookies(res, accessToken, refreshToken) {
  res.cookie(ACCESS_COOKIE, accessToken, cookieBaseOptions(ACCESS_COOKIE_MAX_AGE_MS));
  res.cookie(REFRESH_COOKIE, refreshToken, cookieBaseOptions(REFRESH_COOKIE_MAX_AGE_MS));
}

export function clearAuthCookies(res) {
  res.clearCookie(ACCESS_COOKIE, cookieBaseOptions(0));
  res.clearCookie(REFRESH_COOKIE, cookieBaseOptions(0));
}
