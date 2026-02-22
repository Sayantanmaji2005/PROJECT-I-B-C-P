import express from "express";
import { prisma } from "../lib/prisma.js";
import { ApiError, asyncHandler } from "../lib/http.js";
import { createAuditLog } from "../lib/audit.js";
import { publishNotification } from "../lib/notifications.js";
import { requireAuth, requireRoles } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { createTransactionSchema, transactionIdSchema } from "../validators/schemas.js";

const router = express.Router();

function buildReceipt(transaction) {
  return {
    receiptNumber: `TX-${transaction.id}-${new Date(transaction.createdAt).getTime()}`,
    transactionId: transaction.id,
    campaign: {
      id: transaction.campaign.id,
      title: transaction.campaign.title
    },
    influencer: {
      id: transaction.influencer.id,
      name: transaction.influencer.name,
      email: transaction.influencer.email
    },
    amount: transaction.amount,
    status: transaction.status,
    createdAt: transaction.createdAt,
    releasedAt: transaction.releasedAt
  };
}

router.get("/", requireAuth, asyncHandler(async (req, res) => {
  const userId = Number(req.user.sub);
  let where;

  if (req.user.role === "BRAND") where = { campaign: { brandId: userId } };
  if (req.user.role === "INFLUENCER") where = { influencerId: userId };

  const transactions = await prisma.transaction.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: {
      campaign: { select: { id: true, title: true, brandId: true } },
      influencer: { select: { id: true, name: true, email: true } },
      proposal: { select: { id: true, amount: true, status: true } }
    }
  });

  return res.json(transactions);
}));

router.post(
  "/",
  requireAuth,
  requireRoles("BRAND", "ADMIN"),
  validate(createTransactionSchema),
  asyncHandler(async (req, res) => {
    const { campaignId, influencerId, proposalId, amount } = req.body;

    const campaign = await prisma.campaign.findUnique({ where: { id: campaignId } });
    if (!campaign) throw new ApiError(404, "campaign not found");
    if (req.user.role === "BRAND" && campaign.brandId !== Number(req.user.sub)) throw new ApiError(403, "forbidden");

    const influencer = await prisma.user.findUnique({ where: { id: influencerId } });
    if (!influencer || influencer.role !== "INFLUENCER") {
      throw new ApiError(400, "influencerId must point to an influencer account");
    }

    if (proposalId) {
      const proposal = await prisma.proposal.findUnique({
        where: { id: proposalId },
        include: { match: true }
      });
      if (!proposal) throw new ApiError(404, "proposal not found");
      if (proposal.match.campaignId !== campaignId || proposal.match.influencerId !== influencerId) {
        throw new ApiError(409, "proposal does not belong to this campaign/influencer pair");
      }
      if (proposal.status !== "ACCEPTED") throw new ApiError(409, "proposal must be ACCEPTED before creating transaction");
    }

    const transaction = await prisma.transaction.create({
      data: {
        campaignId,
        influencerId,
        proposalId: proposalId || null,
        amount,
        status: "HELD"
      }
    });

    await createAuditLog(req, {
      action: "transaction.create",
      entityType: "transaction",
      entityId: transaction.id,
      metadata: { campaignId, influencerId, amount }
    });
    publishNotification({
      type: "transaction.created",
      message: `Escrow created for campaign #${campaignId}`,
      userIds: [influencerId, campaign.brandId],
      data: { transactionId: transaction.id, amount }
    });

    return res.status(201).json(transaction);
  })
);

router.patch(
  "/:id/release",
  requireAuth,
  requireRoles("BRAND", "ADMIN"),
  validate(transactionIdSchema),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const transaction = await prisma.transaction.findUnique({
      where: { id },
      include: { campaign: true }
    });
    if (!transaction) throw new ApiError(404, "transaction not found");
    if (req.user.role === "BRAND" && transaction.campaign.brandId !== Number(req.user.sub)) throw new ApiError(403, "forbidden");
    if (transaction.status !== "HELD") throw new ApiError(409, "only HELD transactions can be released");

    const updated = await prisma.transaction.update({
      where: { id },
      data: { status: "RELEASED", releasedAt: new Date() }
    });

    await createAuditLog(req, {
      action: "transaction.release",
      entityType: "transaction",
      entityId: updated.id
    });
    publishNotification({
      type: "transaction.released",
      message: `Payment released for transaction #${updated.id}`,
      userIds: [transaction.influencerId, transaction.campaign.brandId],
      data: { transactionId: updated.id, amount: updated.amount }
    });

    return res.json(updated);
  })
);

router.patch(
  "/:id/refund",
  requireAuth,
  requireRoles("BRAND", "ADMIN"),
  validate(transactionIdSchema),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const transaction = await prisma.transaction.findUnique({
      where: { id },
      include: { campaign: true }
    });
    if (!transaction) throw new ApiError(404, "transaction not found");
    if (req.user.role === "BRAND" && transaction.campaign.brandId !== Number(req.user.sub)) throw new ApiError(403, "forbidden");
    if (transaction.status !== "HELD") throw new ApiError(409, "only HELD transactions can be refunded");

    const updated = await prisma.transaction.update({
      where: { id },
      data: { status: "REFUNDED", releasedAt: null }
    });

    await createAuditLog(req, {
      action: "transaction.refund",
      entityType: "transaction",
      entityId: updated.id
    });
    publishNotification({
      type: "transaction.refunded",
      message: `Transaction #${updated.id} was refunded`,
      userIds: [transaction.influencerId, transaction.campaign.brandId],
      data: { transactionId: updated.id, amount: updated.amount }
    });

    return res.json(updated);
  })
);

router.get(
  "/:id/receipt",
  requireAuth,
  validate(transactionIdSchema),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const transaction = await prisma.transaction.findUnique({
      where: { id },
      include: {
        campaign: true,
        influencer: { select: { id: true, name: true, email: true } }
      }
    });
    if (!transaction) throw new ApiError(404, "transaction not found");

    const userId = Number(req.user.sub);
    const isOwnerBrand = req.user.role === "BRAND" && transaction.campaign.brandId === userId;
    const isOwnerInfluencer = req.user.role === "INFLUENCER" && transaction.influencerId === userId;
    const isAdmin = req.user.role === "ADMIN";
    if (!isOwnerBrand && !isOwnerInfluencer && !isAdmin) throw new ApiError(403, "forbidden");

    return res.json(buildReceipt(transaction));
  })
);

export default router;
