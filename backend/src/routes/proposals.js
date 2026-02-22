import express from "express";
import { prisma } from "../lib/prisma.js";
import { ApiError, asyncHandler } from "../lib/http.js";
import { createAuditLog } from "../lib/audit.js";
import { requireAuth } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { createProposalSchema, proposalStatusSchema } from "../validators/schemas.js";

const router = express.Router();

router.get("/", requireAuth, asyncHandler(async (req, res) => {
  const role = req.user.role;
  const userId = Number(req.user.sub);
  let where;
  if (role === "BRAND") where = { match: { campaign: { brandId: userId } } };
  if (role === "INFLUENCER") where = { match: { influencerId: userId } };

  const proposals = await prisma.proposal.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: {
      match: {
        include: {
          campaign: { select: { id: true, title: true, brandId: true, budget: true } },
          influencer: { select: { id: true, name: true, email: true } }
        }
      }
    }
  });
  return res.json(proposals);
}));

router.post("/", requireAuth, validate(createProposalSchema), asyncHandler(async (req, res) => {
  const match = await prisma.match.findUnique({ where: { id: req.body.matchId }, include: { campaign: true } });
  if (!match) throw new ApiError(404, "match not found");

  const userId = Number(req.user.sub);
  const role = req.user.role;
  const influencerOwner = role === "INFLUENCER" && match.influencerId === userId;
  const brandOwner = role === "BRAND" && match.campaign.brandId === userId;
  if (!influencerOwner && !brandOwner && role !== "ADMIN") throw new ApiError(403, "cannot create proposal for this match");

  const proposal = await prisma.proposal.create({ data: req.body });
  await createAuditLog(req, {
    action: "proposal.create",
    entityType: "proposal",
    entityId: proposal.id,
    metadata: { matchId: proposal.matchId, amount: proposal.amount }
  });

  return res.status(201).json(proposal);
}));

router.patch("/:id/status", requireAuth, validate(proposalStatusSchema), asyncHandler(async (req, res) => {
  const proposalId = Number(req.params.id);
  const nextStatus = req.body.status;

  const proposal = await prisma.proposal.findUnique({
    where: { id: proposalId },
    include: { match: { include: { campaign: true } } }
  });
  if (!proposal) throw new ApiError(404, "proposal not found");

  const userId = Number(req.user.sub);
  const role = req.user.role;
  const influencerOwner = role === "INFLUENCER" && proposal.match.influencerId === userId;
  const brandOwner = role === "BRAND" && proposal.match.campaign.brandId === userId;

  if (role !== "ADMIN") {
    if (influencerOwner && !["DRAFT", "SENT"].includes(nextStatus)) throw new ApiError(403, "influencer can only move to DRAFT or SENT");
    if (brandOwner && !["ACCEPTED", "REJECTED"].includes(nextStatus)) throw new ApiError(403, "brand can only ACCEPT or REJECT");
    if (!influencerOwner && !brandOwner) throw new ApiError(403, "status transition not allowed for this user");
  }

  const updated = await prisma.proposal.update({ where: { id: proposalId }, data: { status: nextStatus } });
  await createAuditLog(req, {
    action: "proposal.status.update",
    entityType: "proposal",
    entityId: updated.id,
    metadata: { status: updated.status }
  });

  return res.json(updated);
}));

export default router;
