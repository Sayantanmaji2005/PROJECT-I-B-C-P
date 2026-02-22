import request from "supertest";
import { afterAll, beforeEach, describe, expect, test } from "vitest";
import { createApp } from "../../src/app.js";
import { prisma } from "../../src/lib/prisma.js";
import { resetDb, uniqueEmail } from "./helpers.js";

const app = createApp();

function extractRefreshCookie(setCookieHeaders = []) {
  const row = setCookieHeaders.find((item) => item.startsWith("cp_refresh="));
  if (!row) return null;
  return row.split(";")[0].replace("cp_refresh=", "");
}

describe("auth and session lifecycle", () => {
  beforeEach(async () => {
    await resetDb();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  test("signup, login, and me return expected auth context", async () => {
    const email = uniqueEmail("brand");
    const agent = request.agent(app);

    const signupRes = await agent.post("/auth/signup").send({
      name: "Brand One",
      email,
      password: "Password123!",
      role: "BRAND"
    });

    expect(signupRes.status).toBe(201);
    expect(signupRes.body.user.role).toBe("BRAND");

    const meRes = await agent.get("/auth/me");

    expect(meRes.status).toBe(200);
    expect(meRes.body.email).toBe(email);

    const loginRes = await agent.post("/auth/login").send({
      email,
      password: "Password123!"
    });

    expect(loginRes.status).toBe(200);
    expect(loginRes.body.user.email).toBe(email);
  });

  test("refresh token reuse revokes active refresh sessions", async () => {
    const email = uniqueEmail("influencer");
    const agent = request.agent(app);

    const signupRes = await agent.post("/auth/signup").send({
      name: "Influencer One",
      email,
      password: "Password123!",
      role: "INFLUENCER"
    });

    const refreshCookie = extractRefreshCookie(signupRes.headers["set-cookie"]);
    expect(refreshCookie).toBeTruthy();

    const refreshRes = await agent.post("/auth/refresh");
    expect(refreshRes.status).toBe(200);

    const replayRes = await request(app)
      .post("/auth/refresh")
      .set("Cookie", `cp_refresh=${refreshCookie}`);

    expect(replayRes.status).toBe(401);
    expect(replayRes.body.error).toMatch(/reuse detected/i);

    const stillValidRes = await agent.post("/auth/refresh");
    expect(stillValidRes.status).toBe(401);
  });

  test("logout revokes refresh tokens", async () => {
    const email = uniqueEmail("brand.logout");
    const agent = request.agent(app);

    await agent.post("/auth/signup").send({
      name: "Brand Logout",
      email,
      password: "Password123!",
      role: "BRAND"
    });

    const logoutRes = await agent.post("/auth/logout");
    expect(logoutRes.status).toBe(200);

    const refreshRes = await agent.post("/auth/refresh");
    expect(refreshRes.status).toBe(401);
  });
});
