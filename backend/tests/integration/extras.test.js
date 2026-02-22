import request from "supertest";
import bcrypt from "bcryptjs";
import { afterAll, beforeEach, describe, expect, test } from "vitest";
import { createApp } from "../../src/app.js";
import { prisma } from "../../src/lib/prisma.js";
import { resetDb, uniqueEmail } from "./helpers.js";

const app = createApp();

describe("phase-2 extras workflow", () => {
  beforeEach(async () => {
    await resetDb();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  test("application -> approval -> transaction -> receipt -> analytics", async () => {
    const brandAgent = request.agent(app);
    const influencerAgent = request.agent(app);

    const brandEmail = uniqueEmail("brand.extra");
    const influencerEmail = uniqueEmail("influencer.extra");

    const brandSignup = await brandAgent.post("/auth/signup").send({
      name: "Brand Extra",
      email: brandEmail,
      password: "Password123!",
      role: "BRAND"
    });
    expect(brandSignup.status).toBe(201);

    const influencerSignup = await influencerAgent.post("/auth/signup").send({
      name: "Influencer Extra",
      email: influencerEmail,
      password: "Password123!",
      role: "INFLUENCER"
    });
    expect(influencerSignup.status).toBe(201);

    const profileRes = await influencerAgent.patch("/api/users/profile").send({
      niche: "fashion",
      followers: 120000,
      engagementRate: 0.2,
      followerQualityScore: 15
    });
    expect(profileRes.status).toBe(200);
    expect(profileRes.body.isFraudFlagged).toBe(true);

    const campaignRes = await brandAgent.post("/api/campaigns").send({
      title: "Spring Campaign",
      budget: 10000,
      description: "Launch campaign",
      targetNiche: "fashion"
    });
    expect(campaignRes.status).toBe(201);
    const campaignId = campaignRes.body.id;

    const applyRes = await influencerAgent.post("/api/applications").send({
      campaignId,
      proposalMessage: "I can deliver 3 reels and 2 stories"
    });
    expect(applyRes.status).toBe(201);
    const applicationId = applyRes.body.id;

    const approveRes = await brandAgent.patch(`/api/applications/${applicationId}/status`).send({ status: "APPROVED" });
    expect(approveRes.status).toBe(200);
    expect(approveRes.body.status).toBe("APPROVED");

    const matchesRes = await influencerAgent.get("/api/matches");
    expect(matchesRes.status).toBe(200);
    expect(matchesRes.body.length).toBeGreaterThan(0);
    const matchId = matchesRes.body[0].id;

    const proposalRes = await influencerAgent.post("/api/proposals").send({
      matchId,
      deliverables: "3 Reels + 2 Stories",
      amount: 1800
    });
    expect(proposalRes.status).toBe(201);

    const proposalAcceptRes = await brandAgent.patch(`/api/proposals/${proposalRes.body.id}/status`).send({ status: "ACCEPTED" });
    expect(proposalAcceptRes.status).toBe(200);

    const transactionRes = await brandAgent.post("/api/transactions").send({
      campaignId,
      influencerId: influencerSignup.body.user.id,
      proposalId: proposalRes.body.id,
      amount: 1800
    });
    expect(transactionRes.status).toBe(201);

    const releasedRes = await brandAgent.patch(`/api/transactions/${transactionRes.body.id}/release`);
    expect(releasedRes.status).toBe(200);
    expect(releasedRes.body.status).toBe("RELEASED");

    const receiptRes = await influencerAgent.get(`/api/transactions/${transactionRes.body.id}/receipt`);
    expect(receiptRes.status).toBe(200);
    expect(receiptRes.body.receiptNumber).toMatch(/^TX-/);

    const brandAnalyticsRes = await brandAgent.get("/api/analytics/brand");
    expect(brandAnalyticsRes.status).toBe(200);
    expect(brandAnalyticsRes.body.metrics).toBeTruthy();

    const influencerAnalyticsRes = await influencerAgent.get("/api/analytics/influencer");
    expect(influencerAnalyticsRes.status).toBe(200);
    expect(influencerAnalyticsRes.body.totals.releasedEarnings).toBeGreaterThanOrEqual(1800);
  });

  test("admin endpoints support moderation and audit visibility", async () => {
    const passwordHash = await bcrypt.hash("Password123!", 10);
    const adminEmail = uniqueEmail("admin.extra");

    await prisma.user.create({
      data: {
        name: "Admin Extra",
        email: adminEmail,
        passwordHash,
        role: "ADMIN"
      }
    });

    const adminAgent = request.agent(app);
    const loginRes = await adminAgent.post("/auth/login").send({
      email: adminEmail,
      password: "Password123!"
    });
    expect(loginRes.status).toBe(200);

    const overviewRes = await adminAgent.get("/api/admin/overview");
    expect(overviewRes.status).toBe(200);
    expect(overviewRes.body.users).toBeGreaterThanOrEqual(1);

    const usersRes = await adminAgent.get("/api/admin/users?role=INFLUENCER");
    expect(usersRes.status).toBe(200);

    const scanRes = await adminAgent.post("/api/admin/fraud-scan");
    expect(scanRes.status).toBe(200);

    const logsRes = await adminAgent.get("/api/admin/audit-logs?limit=10");
    expect(logsRes.status).toBe(200);
    expect(Array.isArray(logsRes.body)).toBe(true);
  });
});
