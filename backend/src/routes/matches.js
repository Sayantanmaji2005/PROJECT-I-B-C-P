import express from "express";
import { prisma } from "../lib/prisma.js";
import { ApiError, asyncHandler } from "../lib/http.js";
import { createAuditLog } from "../lib/audit.js";
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
    return res.status(201).json(match);
  } catch (error) {
    if (error.code === "P2002") throw new ApiError(409, "match already exists for this campaign and influencer");
    throw error;
  }
}));

export default router;
