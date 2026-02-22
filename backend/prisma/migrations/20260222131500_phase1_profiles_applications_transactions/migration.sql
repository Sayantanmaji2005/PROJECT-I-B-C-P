-- CreateEnum
CREATE TYPE "ApplicationStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'WITHDRAWN');

-- CreateEnum
CREATE TYPE "TransactionStatus" AS ENUM ('HELD', 'RELEASED', 'REFUNDED');

-- AlterTable
ALTER TABLE "User"
ADD COLUMN "niche" TEXT,
ADD COLUMN "followers" INTEGER,
ADD COLUMN "engagementRate" DOUBLE PRECISION,
ADD COLUMN "portfolioUrl" TEXT,
ADD COLUMN "socialLinks" JSONB,
ADD COLUMN "followerQualityScore" DOUBLE PRECISION,
ADD COLUMN "isFraudFlagged" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "profileViews" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Campaign"
ADD COLUMN "targetAudience" TEXT,
ADD COLUMN "targetNiche" TEXT,
ADD COLUMN "startDate" TIMESTAMP(3),
ADD COLUMN "endDate" TIMESTAMP(3),
ADD COLUMN "deliverables" TEXT,
ADD COLUMN "objective" TEXT;

-- CreateTable
CREATE TABLE "Application" (
    "id" SERIAL NOT NULL,
    "campaignId" INTEGER NOT NULL,
    "influencerId" INTEGER NOT NULL,
    "proposalMessage" TEXT NOT NULL DEFAULT '',
    "status" "ApplicationStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Application_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Transaction" (
    "id" SERIAL NOT NULL,
    "campaignId" INTEGER NOT NULL,
    "influencerId" INTEGER NOT NULL,
    "proposalId" INTEGER,
    "amount" INTEGER NOT NULL,
    "status" "TransactionStatus" NOT NULL DEFAULT 'HELD',
    "releasedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Transaction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Application_campaignId_influencerId_key" ON "Application"("campaignId", "influencerId");

-- CreateIndex
CREATE INDEX "Transaction_campaignId_idx" ON "Transaction"("campaignId");

-- CreateIndex
CREATE INDEX "Transaction_influencerId_idx" ON "Transaction"("influencerId");

-- AddForeignKey
ALTER TABLE "Application" ADD CONSTRAINT "Application_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Application" ADD CONSTRAINT "Application_influencerId_fkey" FOREIGN KEY ("influencerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_influencerId_fkey" FOREIGN KEY ("influencerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_proposalId_fkey" FOREIGN KEY ("proposalId") REFERENCES "Proposal"("id") ON DELETE SET NULL ON UPDATE CASCADE;
