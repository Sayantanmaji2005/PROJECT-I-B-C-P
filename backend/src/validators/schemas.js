import { z } from "zod";

const nonEmpty = z.string().trim().min(1);
const numericId = z.number().int().positive();
const numericIdParam = z.string().regex(/^\d+$/);

export const authSignupSchema = z.object({
  body: z.object({
    name: nonEmpty.min(2).max(80),
    email: z.string().email(),
    password: z.string().min(8).max(128),
    role: z.enum(["BRAND", "INFLUENCER"])
  })
});

export const authLoginSchema = z.object({
  body: z.object({
    email: z.string().email(),
    password: z.string().min(8).max(128)
  })
});

export const createCampaignSchema = z.object({
  body: z.object({
    title: nonEmpty.min(3).max(120),
    budget: z.number().int().positive().max(100000000),
    description: z.string().max(5000).optional().default(""),
    targetAudience: z.string().max(250).optional(),
    targetNiche: z.string().max(120).optional(),
    startDate: z.coerce.date().optional(),
    endDate: z.coerce.date().optional(),
    deliverables: z.string().max(1000).optional(),
    objective: z.string().max(500).optional()
  }).refine((value) => {
    if (!value.startDate || !value.endDate) return true;
    return value.endDate >= value.startDate;
  }, {
    message: "endDate must be on or after startDate",
    path: ["endDate"]
  })
});

export const createMatchSchema = z.object({
  body: z.object({
    campaignId: numericId,
    influencerId: numericId
  })
});

export const createProposalSchema = z.object({
  body: z.object({
    matchId: numericId,
    deliverables: nonEmpty.min(3).max(500),
    amount: z.number().int().positive().max(100000000)
  })
});

export const proposalStatusSchema = z.object({
  body: z.object({
    status: z.enum(["DRAFT", "SENT", "ACCEPTED", "REJECTED"])
  }),
  params: z.object({
    id: numericIdParam
  })
});

export const updateInfluencerProfileSchema = z.object({
  body: z.object({
    niche: z.string().trim().max(120).optional(),
    followers: z.number().int().nonnegative().max(2000000000).optional(),
    engagementRate: z.number().min(0).max(100).optional(),
    portfolioUrl: z.string().url().optional(),
    socialLinks: z.array(z.string().url()).max(12).optional(),
    followerQualityScore: z.number().min(0).max(100).optional()
  })
});

export const createApplicationSchema = z.object({
  body: z.object({
    campaignId: numericId,
    proposalMessage: z.string().max(2000).optional().default("")
  })
});

export const applicationStatusSchema = z.object({
  body: z.object({
    status: z.enum(["PENDING", "APPROVED", "REJECTED", "WITHDRAWN"])
  }),
  params: z.object({
    id: numericIdParam
  })
});

export const createTransactionSchema = z.object({
  body: z.object({
    campaignId: numericId,
    influencerId: numericId,
    proposalId: numericId.optional(),
    amount: z.number().int().positive().max(100000000)
  })
});

export const transactionIdSchema = z.object({
  params: z.object({
    id: numericIdParam
  })
});

export const createMediaAssetSchema = z.object({
  body: z.object({
    url: z.string().url(),
    publicId: nonEmpty.max(255),
    resourceType: z.enum(["image", "video", "raw"]),
    campaignId: numericId.optional()
  })
});
