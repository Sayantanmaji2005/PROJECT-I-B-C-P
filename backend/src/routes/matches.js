import express from "express";
import { prisma } from "../lib/prisma.js";
import { ApiError, asyncHandler } from "../lib/http.js";
import { createAuditLog } from "../lib/audit.js";
import { publishNotification } from "../lib/notifications.js";
import { requireAuth, requireRoles } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { createMatchSchema } from "../validators/schemas.js";

const router = express.Router();

router.get("/", requireAuth, asyncHandler(async (req, res) => {
  const role = req.user.role;
  const userId = Number(req.user.sub);
  let where;
  if (role === "BRAND") where = { campaign: { brandId: userId } };
  if (role === "INFLUENCER") where = { influencerId: userId };

  const matches = await prisma.match.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: {
      campaign: { select: { id: true, title: true, budget: true, status: true, brandId: true } },
      influencer: { select: { id: true, name: true, email: true } }
    }
  });
  return res.json(matches);
}));

router.post("/", requireAuth, requireRoles("BRAND"), validate(createMatchSchema), asyncHandler(async (req, res) => {
  const { campaignId, influencerId } = req.body;
  const campaign = await prisma.campaign.findFirst({
    where: { id: campaignId, brandId: Number(req.user.sub) }
  });
  if (!campaign) throw new ApiError(403, "cannot create matches for another brand campaign");
  if (campaign.status !== "OPEN") throw new ApiError(409, "campaign is not open for new matches");

  const influencer = await prisma.user.findUnique({ where: { id: influencerId } });
  if (!influencer || influencer.role !== "INFLUENCER") throw new ApiError(400, "influencerId must point to an influencer account");

  try {
    const match = await prisma.match.create({ data: { campaignId, influencerId } });
    await createAuditLog(req, {
      action: "match.create",
      entityType: "match",
      entityId: match.id,
      metadata: { campaignId, influencerId }
    });
    publishNotification({
      type: "match.created",
      message: `You were invited to campaign #${campaignId}`,
      userIds: [influencerId],
      data: { campaignId, influencerId, matchId: match.id }
    });
    return res.status(201).json(match);
  } catch (error) {
    if (error.code === "P2002") throw new ApiError(409, "match already exists for this campaign and influencer");
    throw error;
  }
}));

router.get(
  "/recommendations",
  requireAuth,
  requireRoles("BRAND", "ADMIN"),
  asyncHandler(async (req, res) => {
    const campaignId = Number(req.query.campaignId);
    if (!Number.isInteger(campaignId) || campaignId <= 0) {
      throw new ApiError(400, "campaignId query parameter is required");
    }

    const campaign = await prisma.campaign.findUnique({ where: { id: campaignId } });
    if (!campaign) throw new ApiError(404, "campaign not found");
    if (req.user.role === "BRAND" && campaign.brandId !== Number(req.user.sub)) {
      throw new ApiError(403, "forbidden");
    }

    const influencers = await prisma.user.findMany({
      where: { role: "INFLUENCER" },
      select: {
        id: true,
        name: true,
        email: true,
        niche: true,
        followers: true,
        engagementRate: true,
        followerQualityScore: true,
        isFraudFlagged: true
      }
    });

    const applications = await prisma.application.findMany({
      where: { campaignId },
      select: { influencerId: true, status: true }
    });
    const matches = await prisma.match.findMany({
      where: { campaignId },
      select: { influencerId: true }
    });

    const applicationMap = new Map(applications.map((item) => [item.influencerId, item.status]));
    const matchSet = new Set(matches.map((item) => item.influencerId));
    const normalizedTargetNiche = String(campaign.targetNiche || "").trim().toLowerCase();

    function calcRelevance(niche) {
      if (!normalizedTargetNiche) return 50;
      const normalizedNiche = String(niche || "").trim().toLowerCase();
      if (!normalizedNiche) return 20;
      if (normalizedNiche === normalizedTargetNiche) return 100;
      if (normalizedNiche.includes(normalizedTargetNiche) || normalizedTargetNiche.includes(normalizedNiche)) return 75;
      return 30;
    }

    const recommendations = influencers
      .map((influencer) => {
        const engagement = Math.max(0, Math.min(100, Number(influencer.engagementRate || 0)));
        const relevance = calcRelevance(influencer.niche);
        const followerQuality = Math.max(0, Math.min(100, Number(influencer.followerQualityScore || 40)));
        const baseScore = engagement * 0.5 + relevance * 0.3 + followerQuality * 0.2;
        const fraudPenalty = influencer.isFraudFlagged ? 25 : 0;
        const matchScore = Math.max(0, Math.round((baseScore - fraudPenalty) * 100) / 100);

        return {
          influencer,
          engagement,
          relevance,
          followerQuality,
          matchScore,
          alreadyMatched: matchSet.has(influencer.id),
          applicationStatus: applicationMap.get(influencer.id) || null
        };
      })
      .sort((a, b) => b.matchScore - a.matchScore || (b.influencer.followers || 0) - (a.influencer.followers || 0));

    return res.json({
      campaign: { id: campaign.id, title: campaign.title, targetNiche: campaign.targetNiche || null },
      formula: "matchScore = engagement*0.5 + relevance*0.3 + followerQuality*0.2 - fraudPenalty",
      items: recommendations
    });
  })
);

export default router;
