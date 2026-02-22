import express from "express";
import { prisma } from "../lib/prisma.js";
import { asyncHandler } from "../lib/http.js";
import { requireAuth, requireRoles } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { createAuditLog } from "../lib/audit.js";
import { updateInfluencerProfileSchema } from "../validators/schemas.js";

const router = express.Router();

function shouldFlagFraud({ followers, engagementRate, followerQualityScore }) {
  const hasVeryLowEngagementForLargeAccount =
    Number(followers || 0) >= 50000 && Number(engagementRate || 0) > 0 && Number(engagementRate || 0) < 0.5;
  const hasPoorFollowerQuality = Number(followerQualityScore || 100) > 0 && Number(followerQualityScore || 100) < 20;
  const suspiciousRatio =
    Number(followers || 0) >= 150000 && Number(engagementRate || 0) > 0 && Number(engagementRate || 0) < 0.3;

  return hasVeryLowEngagementForLargeAccount || hasPoorFollowerQuality || suspiciousRatio;
}

router.get("/influencers", requireAuth, requireRoles("BRAND", "ADMIN"), asyncHandler(async (_req, res) => {
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
      isFraudFlagged: true,
      portfolioUrl: true,
      socialLinks: true,
      createdAt: true
    },
    orderBy: { createdAt: "desc" }
  });

  return res.json(influencers);
}));

router.get("/profile", requireAuth, asyncHandler(async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: Number(req.user.sub) },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      niche: true,
      followers: true,
      engagementRate: true,
      portfolioUrl: true,
      socialLinks: true,
      followerQualityScore: true,
      isFraudFlagged: true,
      profileViews: true,
      createdAt: true
    }
  });

  return res.json(user);
}));

router.patch(
  "/profile",
  requireAuth,
  requireRoles("INFLUENCER"),
  validate(updateInfluencerProfileSchema),
  asyncHandler(async (req, res) => {
    const nextFollowers = req.body.followers;
    const nextEngagementRate = req.body.engagementRate;
    const nextFollowerQualityScore = req.body.followerQualityScore;
    const autoFraudFlag = shouldFlagFraud({
      followers: nextFollowers,
      engagementRate: nextEngagementRate,
      followerQualityScore: nextFollowerQualityScore
    });

    const profile = await prisma.user.update({
      where: { id: Number(req.user.sub) },
      data: {
        niche: req.body.niche,
        followers: req.body.followers,
        engagementRate: req.body.engagementRate,
        portfolioUrl: req.body.portfolioUrl,
        socialLinks: req.body.socialLinks,
        followerQualityScore: req.body.followerQualityScore,
        isFraudFlagged: autoFraudFlag
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        niche: true,
        followers: true,
        engagementRate: true,
        portfolioUrl: true,
        socialLinks: true,
        followerQualityScore: true,
        isFraudFlagged: true,
        profileViews: true
      }
    });

    await createAuditLog(req, {
      action: "influencer.profile.update",
      entityType: "user",
      entityId: profile.id,
      metadata: { isFraudFlagged: profile.isFraudFlagged }
    });

    return res.json(profile);
  })
);

export default router;
