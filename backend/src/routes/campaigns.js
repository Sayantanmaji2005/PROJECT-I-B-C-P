import express from "express";
import { prisma } from "../lib/prisma.js";
import { ApiError, asyncHandler } from "../lib/http.js";
import { createAuditLog } from "../lib/audit.js";
import { requireAuth, requireRoles } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { createCampaignSchema } from "../validators/schemas.js";

const router = express.Router();

router.get("/", asyncHandler(async (_req, res) => {
  const campaigns = await prisma.campaign.findMany({
    orderBy: { createdAt: "desc" },
    include: { brand: { select: { id: true, name: true } } }
  });
  return res.json(campaigns);
}));

router.get("/mine", requireAuth, requireRoles("BRAND", "ADMIN"), asyncHandler(async (req, res) => {
  const campaigns = await prisma.campaign.findMany({
    where: req.user.role === "ADMIN" ? undefined : { brandId: Number(req.user.sub) },
    orderBy: { createdAt: "desc" }
  });
  return res.json(campaigns);
}));

router.post("/", requireAuth, requireRoles("BRAND"), validate(createCampaignSchema), asyncHandler(async (req, res) => {
  const campaign = await prisma.campaign.create({
    data: { brandId: Number(req.user.sub), title: req.body.title, budget: req.body.budget, description: req.body.description }
  });

  await createAuditLog(req, {
    action: "campaign.create",
    entityType: "campaign",
    entityId: campaign.id,
    metadata: { title: campaign.title }
  });

  return res.status(201).json(campaign);
}));

router.patch("/:id/close", requireAuth, requireRoles("BRAND", "ADMIN"), asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const campaign = await prisma.campaign.findUnique({ where: { id } });
  if (!campaign) throw new ApiError(404, "campaign not found");
  if (req.user.role !== "ADMIN" && campaign.brandId !== Number(req.user.sub)) throw new ApiError(403, "forbidden");

  const updated = await prisma.campaign.update({ where: { id }, data: { status: "CLOSED" } });
  await createAuditLog(req, {
    action: "campaign.close",
    entityType: "campaign",
    entityId: updated.id
  });

  return res.json(updated);
}));

export default router;
