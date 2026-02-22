import express from "express";
import { prisma } from "../lib/prisma.js";
import { asyncHandler } from "../lib/http.js";
import { requireAuth, requireRoles } from "../middleware/auth.js";

const router = express.Router();

router.get(
  "/brand",
  requireAuth,
  requireRoles("BRAND", "ADMIN"),
  asyncHandler(async (req, res) => {
    const userId = Number(req.user.sub);
    const whereCampaign = req.user.role === "ADMIN" ? {} : { brandId: userId };

    const campaigns = await prisma.campaign.findMany({
      where: whereCampaign,
      select: { id: true, budget: true }
    });
    const campaignIds = campaigns.map((item) => item.id);

    const proposals = await prisma.proposal.findMany({
      where: {
        status: "ACCEPTED",
        match: { campaignId: { in: campaignIds } }
      },
      include: {
        match: {
          include: {
            influencer: {
              select: { followers: true, engagementRate: true }
            }
          }
        }
      }
    });

    const transactions = await prisma.transaction.findMany({
      where: { campaignId: { in: campaignIds } },
      select: { amount: true, status: true }
    });

    const totalBudget = campaigns.reduce((sum, item) => sum + item.budget, 0);
    const releasedSpend = transactions
      .filter((item) => item.status === "RELEASED")
      .reduce((sum, item) => sum + item.amount, 0);
    const heldSpend = transactions
      .filter((item) => item.status === "HELD")
      .reduce((sum, item) => sum + item.amount, 0);
    const acceptedCount = proposals.length;

    const estimatedReach = proposals.reduce((sum, item) => sum + Number(item.match.influencer.followers || 0), 0);
    const estimatedEngagements = proposals.reduce(
      (sum, item) =>
        sum +
        (Number(item.match.influencer.followers || 0) * Number(item.match.influencer.engagementRate || 0)) / 100,
      0
    );
    const estimatedConversions = Math.round(estimatedEngagements * 0.04);
    const estimatedRevenue = estimatedConversions * 45;
    const roiPercent = releasedSpend > 0 ? ((estimatedRevenue - releasedSpend) / releasedSpend) * 100 : 0;
    const conversionRate = estimatedReach > 0 ? (estimatedConversions / estimatedReach) * 100 : 0;
    const costPerEngagement = estimatedEngagements > 0 ? releasedSpend / estimatedEngagements : 0;

    return res.json({
      totals: {
        campaigns: campaigns.length,
        acceptedProposals: acceptedCount,
        totalBudget,
        heldSpend,
        releasedSpend
      },
      metrics: {
        estimatedReach: Math.round(estimatedReach),
        estimatedEngagements: Math.round(estimatedEngagements),
        estimatedConversions,
        estimatedRevenue,
        roiPercent: Math.round(roiPercent * 100) / 100,
        conversionRate: Math.round(conversionRate * 100) / 100,
        costPerEngagement: Math.round(costPerEngagement * 100) / 100
      }
    });
  })
);

router.get(
  "/influencer",
  requireAuth,
  requireRoles("INFLUENCER", "ADMIN"),
  asyncHandler(async (req, res) => {
    const userId = Number(req.user.sub);
    const whereInfluencer = req.user.role === "ADMIN" ? {} : { influencerId: userId };

    const transactions = await prisma.transaction.findMany({
      where: whereInfluencer,
      select: { amount: true, status: true, createdAt: true }
    });
    const proposals = await prisma.proposal.findMany({
      where: {
        match: req.user.role === "ADMIN" ? undefined : { influencerId: userId }
      },
      select: { status: true, amount: true }
    });

    const profile = req.user.role === "ADMIN"
      ? null
      : await prisma.user.findUnique({
          where: { id: userId },
          select: { profileViews: true }
        });

    const releasedEarnings = transactions
      .filter((item) => item.status === "RELEASED")
      .reduce((sum, item) => sum + item.amount, 0);
    const pendingEarnings = transactions
      .filter((item) => item.status === "HELD")
      .reduce((sum, item) => sum + item.amount, 0);
    const acceptedProposals = proposals.filter((item) => item.status === "ACCEPTED").length;
    const sentProposals = proposals.filter((item) => item.status === "SENT" || item.status === "ACCEPTED").length;
    const acceptanceRate = sentProposals > 0 ? (acceptedProposals / sentProposals) * 100 : 0;
    const averageDealSize = acceptedProposals > 0
      ? proposals.filter((item) => item.status === "ACCEPTED").reduce((sum, item) => sum + item.amount, 0) / acceptedProposals
      : 0;

    return res.json({
      totals: {
        releasedEarnings,
        pendingEarnings,
        proposals: proposals.length,
        acceptedProposals,
        profileViews: profile?.profileViews || 0
      },
      metrics: {
        acceptanceRate: Math.round(acceptanceRate * 100) / 100,
        averageDealSize: Math.round(averageDealSize * 100) / 100
      }
    });
  })
);

export default router;
