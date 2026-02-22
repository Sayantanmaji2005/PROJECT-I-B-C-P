import { prisma } from "../../src/lib/prisma.js";

export async function resetDb() {
  await prisma.$executeRawUnsafe(
    'TRUNCATE TABLE "MediaAsset", "Transaction", "Application", "RefreshToken", "Proposal", "Match", "Campaign", "AuditLog", "User" RESTART IDENTITY CASCADE;'
  );
}

export function uniqueEmail(prefix) {
  return `${prefix}.${Date.now()}.${Math.floor(Math.random() * 100000)}@test.local`;
}
