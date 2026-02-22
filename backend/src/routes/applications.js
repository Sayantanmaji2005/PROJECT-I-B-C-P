import express from "express";
import { prisma } from "../lib/prisma.js";
import { ApiError, asyncHandler } from "../lib/http.js";
import { createAuditLog } from "../lib/audit.js";
import { publishNotification } from "../lib/notifications.js";
import { requireAuth, requireRoles } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { applicationStatusSchema, createApplicationSchema } from "../validators/schemas.js";

const router = express.Router();

router.get("/", requireAuth, asyncHandler(async (req, res) => {
  const userId = Number(req.user.sub);
  let where;

  if (req.user.role === "BRAND") where = { campaign: { brandId: userId } };
  if (req.user.role === "INFLUENCER") where = { influencerId: userId };

  const applications = await prisma.application.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: {
      campaign: { select: { id: true, title: true, status: true, brandId: true } },
      influencer: {
        select: {
          id: true,
          name: true,
          email: true,
          niche: true,
          followers: true,
          engagementRate: true,
          followerQualityScore: true
        }
      }
    }
  });

  return res.json(applications);
}));

router.post(
  "/",
  requireAuth,
  requireRoles("INFLUENCER"),
  validate(createApplicationSchema),
  asyncHandler(async (req, res) => {
    const campaign = await prisma.campaign.findUnique({ where: { id: req.body.campaignId } });
    if (!campaign) throw new ApiError(404, "campaign not found");
    if (campaign.status !== "OPEN") throw new ApiError(409, "campaign is not accepting applications");

    try {
      const application = await prisma.application.create({
        data: {
          campaignId: req.body.campaignId,
          influencerId: Number(req.user.sub),
          proposalMessage: req.body.proposalMessage
        }
      });

      await createAuditLog(req, {
        action: "application.create",
        entityType: "application",
        entityId: application.id,
        metadata: { campaignId: req.body.campaignId }
      });
      publishNotification({
        type: "application.created",
        message: `New application received for campaign #${req.body.campaignId}`,
        userIds: [campaign.brandId],
        data: { applicationId: application.id, campaignId: req.body.campaignId }
      });

      return res.status(201).json(application);
    } catch (error) {
      if (error.code === "P2002") throw new ApiError(409, "you already applied to this campaign");
      throw error;
    }
  })
);

router.patch(
  "/:id/status",
  requireAuth,
  requireRoles("BRAND", "INFLUENCER", "ADMIN"),
  validate(applicationStatusSchema),
  asyncHandler(async (req, res) => {
    const applicationId = Number(req.params.id);
    const nextStatus = req.body.status;

    const application = await prisma.application.findUnique({
      where: { id: applicationId },
      include: { campaign: true }
    });
    if (!application) throw new ApiError(404, "application not found");

    const userId = Number(req.user.sub);
    const isBrandOwner = req.user.role === "BRAND" && application.campaign.brandId === userId;
    const isInfluencerOwner = req.user.role === "INFLUENCER" && application.influencerId === userId;
    const isAdmin = req.user.role === "ADMIN";

    if (!isBrandOwner && !isInfluencerOwner && !isAdmin) throw new ApiError(403, "forbidden");
    if (isBrandOwner && !["APPROVED", "REJECTED"].includes(nextStatus)) {
      throw new ApiError(403, "brand can only APPROVE or REJECT");
    }
    if (isInfluencerOwner && nextStatus !== "WITHDRAWN") {
      throw new ApiError(403, "influencer can only WITHDRAW an application");
    }

    const updated = await prisma.application.update({
      where: { id: applicationId },
      data: { status: nextStatus }
    });

    if (nextStatus === "APPROVED") {
      await prisma.match.upsert({
        where: {
          campaignId_influencerId: {
            campaignId: application.campaignId,
            influencerId: application.influencerId
          }
        },
        update: {},
        create: {
          campaignId: application.campaignId,
          influencerId: application.influencerId
        }
      });
    }

    await createAuditLog(req, {
      action: "application.status.update",
      entityType: "application",
      entityId: updated.id,
      metadata: { status: updated.status }
    });
    publishNotification({
      type: "application.status.updated",
      message: `Your application #${updated.id} is now ${updated.status}`,
      userIds: [application.influencerId],
      data: { applicationId: updated.id, status: updated.status, campaignId: application.campaignId }
    });

    return res.json(updated);
  })
);

export default router;
