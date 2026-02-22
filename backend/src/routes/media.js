import express from "express";
import { prisma } from "../lib/prisma.js";
import { ApiError, asyncHandler } from "../lib/http.js";
import { requireAuth, requireRoles } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { createMediaAssetSchema } from "../validators/schemas.js";
import { createAuditLog } from "../lib/audit.js";

const router = express.Router();

router.get("/", requireAuth, asyncHandler(async (req, res) => {
  const userId = Number(req.user.sub);
  const where = req.user.role === "ADMIN" ? {} : { userId };
  const assets = await prisma.mediaAsset.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: {
      campaign: { select: { id: true, title: true } }
    }
  });
  return res.json(assets);
}));

router.post(
  "/",
  requireAuth,
  requireRoles("INFLUENCER", "BRAND", "ADMIN"),
  validate(createMediaAssetSchema),
  asyncHandler(async (req, res) => {
    const userId = Number(req.user.sub);
    let campaignId = req.body.campaignId || null;

    if (campaignId) {
      const campaign = await prisma.campaign.findUnique({ where: { id: campaignId } });
      if (!campaign) throw new ApiError(404, "campaign not found");
      if (req.user.role === "BRAND" && campaign.brandId !== userId) throw new ApiError(403, "forbidden");
      if (req.user.role === "INFLUENCER") {
        // influencer can only attach media to campaigns where they have a match
        const match = await prisma.match.findFirst({ where: { campaignId, influencerId: userId } });
        if (!match) throw new ApiError(403, "forbidden");
      }
    }

    const asset = await prisma.mediaAsset.create({
      data: {
        userId,
        campaignId,
        url: req.body.url,
        publicId: req.body.publicId,
        resourceType: req.body.resourceType
      }
    });

    await createAuditLog(req, {
      action: "media.asset.create",
      entityType: "media_asset",
      entityId: asset.id,
      metadata: { campaignId: asset.campaignId, resourceType: asset.resourceType }
    });

    return res.status(201).json(asset);
  })
);

export default router;
