import express from "express";
import { prisma } from "../lib/prisma.js";
import { ApiError, asyncHandler } from "../lib/http.js";
import { requireAuth, requireRoles } from "../middleware/auth.js";
import { createAuditLog } from "../lib/audit.js";

const router = express.Router();

router.use(requireAuth, requireRoles("ADMIN"));

router.get("/overview", asyncHandler(async (_req, res) => {
  const [users, campaigns, applications, transactions, proposals] = await Promise.all([
    prisma.user.count(),
    prisma.campaign.count(),
    prisma.application.count(),
    prisma.transaction.count(),
    prisma.proposal.count()
  ]);

  return res.json({ users, campaigns, applications, transactions, proposals });
}));

router.get("/users", asyncHandler(async (req, res) => {
  const role = req.query.role ? String(req.query.role).toUpperCase() : null;
  const where = role && ["ADMIN", "BRAND", "INFLUENCER"].includes(role) ? { role } : undefined;

  const users = await prisma.user.findMany({
    where,
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      niche: true,
      followers: true,
      engagementRate: true,
      followerQualityScore: true,
      isFraudFlagged: true,
      createdAt: true
    }
  });

  return res.json(users);
}));

router.patch("/users/:id/fraud-flag", asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) throw new ApiError(400, "invalid user id");
  if (typeof req.body?.isFraudFlagged !== "boolean") throw new ApiError(400, "isFraudFlagged must be boolean");

  const user = await prisma.user.update({
    where: { id },
    data: { isFraudFlagged: req.body.isFraudFlagged },
    select: { id: true, role: true, name: true, email: true, isFraudFlagged: true }
  });

  await createAuditLog(req, {
    action: "admin.user.fraud_flag.update",
    entityType: "user",
    entityId: user.id,
    metadata: { isFraudFlagged: user.isFraudFlagged }
  });

  return res.json(user);
}));

router.get("/audit-logs", asyncHandler(async (req, res) => {
  const limit = Number(req.query.limit) || 50;
  const logs = await prisma.auditLog.findMany({
    orderBy: { createdAt: "desc" },
    take: Math.max(1, Math.min(200, limit))
  });
  return res.json(logs);
}));

router.post("/fraud-scan", asyncHandler(async (req, res) => {
  const influencers = await prisma.user.findMany({
    where: { role: "INFLUENCER" },
    select: { id: true, followers: true, engagementRate: true, followerQualityScore: true, isFraudFlagged: true }
  });

  const nextFlaggedIds = influencers
    .filter((item) => {
      const lowEngagement = Number(item.followers || 0) >= 50000 && Number(item.engagementRate || 0) < 0.5;
      const poorQuality = Number(item.followerQualityScore || 100) < 20;
      return lowEngagement || poorQuality;
    })
    .map((item) => item.id);

  await prisma.user.updateMany({
    where: { role: "INFLUENCER", id: { in: nextFlaggedIds } },
    data: { isFraudFlagged: true }
  });
  await prisma.user.updateMany({
    where: { role: "INFLUENCER", id: { notIn: nextFlaggedIds } },
    data: { isFraudFlagged: false }
  });

  await createAuditLog(req, {
    action: "admin.fraud_scan.run",
    entityType: "system",
    metadata: { flaggedCount: nextFlaggedIds.length }
  });

  return res.json({ flaggedCount: nextFlaggedIds.length });
}));

export default router;
