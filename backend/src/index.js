import { PORT } from "./config.js";
import { createApp } from "./app.js";
import { ensureDefaultAdmin } from "./lib/bootstrap.js";
import { prisma } from "./lib/prisma.js";

const app = createApp();

async function start() {
  try {
    await ensureDefaultAdmin();
    app.listen(PORT, () => {
      console.log(`API running on http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error("Failed to start API", error);
    await prisma.$disconnect();
    process.exit(1);
  }
}

start();
