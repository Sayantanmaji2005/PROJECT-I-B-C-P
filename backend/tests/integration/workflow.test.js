import request from "supertest";
import { afterAll, beforeEach, describe, expect, test } from "vitest";
import { createApp } from "../../src/app.js";
import { prisma } from "../../src/lib/prisma.js";
import { resetDb, uniqueEmail } from "./helpers.js";

const app = createApp();

async function signupUser(role, namePrefix) {
  const agent = request.agent(app);
  const email = uniqueEmail(namePrefix.toLowerCase());

  const res = await agent.post("/auth/signup").send({
    name: `${namePrefix} User`,
    email,
    password: "Password123!",
    role
  });

  return {
    agent,
    user: res.body.user
  };
}

describe("role-based workflow authorization", () => {
  beforeEach(async () => {
    await resetDb();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  test("campaign, match, and proposal flows enforce ownership and role boundaries", async () => {
    const brandA = await signupUser("BRAND", "BrandA");
    const brandB = await signupUser("BRAND", "BrandB");
    const influencer = await signupUser("INFLUENCER", "InfluencerA");

    const badCampaignRes = await influencer.agent
      .post("/api/campaigns")
      .send({ title: "Invalid", budget: 1000, description: "Nope" });

    expect(badCampaignRes.status).toBe(403);

    const campaignRes = await brandA.agent
      .post("/api/campaigns")
      .send({ title: "Summer Launch", budget: 20000, description: "UGC campaign" });

    expect(campaignRes.status).toBe(201);
    const campaignId = campaignRes.body.id;

    const wrongBrandMatchRes = await brandB.agent
      .post("/api/matches")
      .send({ campaignId, influencerId: influencer.user.id });

    expect(wrongBrandMatchRes.status).toBe(403);

    const matchRes = await brandA.agent
      .post("/api/matches")
      .send({ campaignId, influencerId: influencer.user.id });

    expect(matchRes.status).toBe(201);
    const matchId = matchRes.body.id;

    const proposalRes = await influencer.agent
      .post("/api/proposals")
      .send({ matchId, deliverables: "2 Reels + 1 Story", amount: 1800 });

    expect(proposalRes.status).toBe(201);
    const proposalId = proposalRes.body.id;

    const influencerAcceptRes = await influencer.agent
      .patch(`/api/proposals/${proposalId}/status`)
      .send({ status: "ACCEPTED" });

    expect(influencerAcceptRes.status).toBe(403);

    const brandAcceptRes = await brandA.agent
      .patch(`/api/proposals/${proposalId}/status`)
      .send({ status: "ACCEPTED" });

    expect(brandAcceptRes.status).toBe(200);
    expect(brandAcceptRes.body.status).toBe("ACCEPTED");

    const influencersRes = await brandA.agent.get("/api/users/influencers");

    expect(influencersRes.status).toBe(200);
    expect(influencersRes.body.some((item) => item.id === influencer.user.id)).toBe(true);

    const closeCampaignRes = await brandA.agent.patch(`/api/campaigns/${campaignId}/close`);

    expect(closeCampaignRes.status).toBe(200);
    expect(closeCampaignRes.body.status).toBe("CLOSED");

    const matchOnClosedCampaignRes = await brandA.agent
      .post("/api/matches")
      .send({ campaignId, influencerId: influencer.user.id });

    expect(matchOnClosedCampaignRes.status).toBe(409);
  });
});
