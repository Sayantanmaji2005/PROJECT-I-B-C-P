import dotenv from "dotenv";
import { prisma } from "../src/lib/prisma.js";

dotenv.config({ path: ".env.test" });
dotenv.config();

process.env.DATABASE_URL ||= "postgresql://postgres:postgres@localhost:5433/collab_platform_test?schema=public";

async function main() {
  await prisma.$executeRawUnsafe('TRUNCATE TABLE "RefreshToken", "Proposal", "Match", "Campaign", "User" RESTART IDENTITY CASCADE;');
}

main()
  .catch((error) => {
    console.error("Failed to reset test database", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
