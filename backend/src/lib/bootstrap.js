import bcrypt from "bcryptjs";
import { prisma } from "./prisma.js";
import { DEFAULT_ADMIN_EMAIL, DEFAULT_ADMIN_PASSWORD } from "../config.js";

export async function ensureDefaultAdmin() {
  const passwordHash = await bcrypt.hash(DEFAULT_ADMIN_PASSWORD, 10);

  await prisma.user.upsert({
    where: { email: DEFAULT_ADMIN_EMAIL },
    update: {
      role: "ADMIN",
      passwordHash
    },
    create: {
      name: "Platform Admin",
      email: DEFAULT_ADMIN_EMAIL,
      role: "ADMIN",
      passwordHash
    }
  });
}
