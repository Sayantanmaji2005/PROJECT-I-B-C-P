import { prisma } from "../../src/lib/prisma.js";

export async function resetDb() {
  await prisma.$executeRawUnsafe('TRUNCATE TABLE "RefreshToken", "Proposal", "Match", "Campaign", "User" RESTART IDENTITY CASCADE;');
}

export function uniqueEmail(prefix) {
  return `${prefix}.${Date.now()}.${Math.floor(Math.random() * 100000)}@test.local`;
}
