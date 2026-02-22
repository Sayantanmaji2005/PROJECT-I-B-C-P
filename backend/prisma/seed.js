import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash("Password123!", 10);

  const brand = await prisma.user.upsert({
    where: { email: "brand.demo@collab.local" },
    update: { name: "Demo Brand", role: "BRAND" },
    create: {
      name: "Demo Brand",
      email: "brand.demo@collab.local",
      role: "BRAND",
      passwordHash
    }
  });

  const influencer = await prisma.user.upsert({
    where: { email: "influencer.demo@collab.local" },
    update: { name: "Demo Influencer", role: "INFLUENCER" },
    create: {
      name: "Demo Influencer",
      email: "influencer.demo@collab.local",
      role: "INFLUENCER",
      passwordHash
    }
  });

  await prisma.user.upsert({
    where: { email: "admin.demo@collab.local" },
    update: { name: "Demo Admin", role: "ADMIN" },
    create: {
      name: "Demo Admin",
      email: "admin.demo@collab.local",
      role: "ADMIN",
      passwordHash
    }
  });

  let campaign = await prisma.campaign.findFirst({
    where: {
      brandId: brand.id,
      title: "Demo Product Launch"
    }
  });

  if (!campaign) {
    campaign = await prisma.campaign.create({
      data: {
        brandId: brand.id,
        title: "Demo Product Launch",
        budget: 2500,
        description: "Need UGC creators for a 2-week launch push"
      }
    });
  }

  const match = await prisma.match.upsert({
    where: {
      campaignId_influencerId: {
        campaignId: campaign.id,
        influencerId: influencer.id
      }
    },
    update: {},
    create: {
      campaignId: campaign.id,
      influencerId: influencer.id
    }
  });

  const existingProposal = await prisma.proposal.findFirst({
    where: {
      matchId: match.id,
      deliverables: "2 Reels + 3 Stories"
    }
  });

  if (!existingProposal) {
    await prisma.proposal.create({
      data: {
        matchId: match.id,
        deliverables: "2 Reels + 3 Stories",
        amount: 800,
        status: "SENT"
      }
    });
  }

  console.log("Seed complete");
  console.log("Brand login: brand.demo@collab.local / Password123!");
  console.log("Influencer login: influencer.demo@collab.local / Password123!");
  console.log("Admin login: admin.demo@collab.local / Password123!");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
