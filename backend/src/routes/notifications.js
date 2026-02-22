import express from "express";
import { requireAuth } from "../middleware/auth.js";
import { asyncHandler } from "../lib/http.js";
import { listRecentNotificationsFor, subscribeNotifications } from "../lib/notifications.js";

const router = express.Router();

router.get("/stream", requireAuth, (req, res) => {
  subscribeNotifications(req, res);
});

router.get("/recent", requireAuth, asyncHandler(async (req, res) => {
  return res.json(listRecentNotificationsFor(req.user));
}));

export default router;
