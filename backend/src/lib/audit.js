import { prisma } from "./prisma.js";

export async function createAuditLog(req, data) {
  try {
    await prisma.auditLog.create({
      data: {
        actorId: req.user ? Number(req.user.sub) : null,
        action: data.action,
        entityType: data.entityType,
        entityId: data.entityId ? String(data.entityId) : null,
        metadata: data.metadata || null,
        ipAddress: req.ip || null,
        userAgent: req.headers["user-agent"] || null
      }
    });
  } catch (_error) {
    // audit write failures should not break primary request flow
  }
}
