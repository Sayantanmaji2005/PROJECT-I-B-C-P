import express from "express";
import { prisma } from "../lib/prisma.js";
import { asyncHandler } from "../lib/http.js";
import { requireAuth, requireRoles } from "../middleware/auth.js";

const router = express.Router();

router.get("/influencers", requireAuth, requireRoles("BRAND", "ADMIN"), asyncHandler(async (_req, res) => {
  const influencers = await prisma.user.findMany({
    where: { role: "INFLUENCER" },
    select: { id: true, name: true, email: true, createdAt: true },
    orderBy: { createdAt: "desc" }
  });

  return res.json(influencers);
}));

export default router;
