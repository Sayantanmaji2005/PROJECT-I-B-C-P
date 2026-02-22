import { z } from "zod";

const nonEmpty = z.string().trim().min(1);

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
    description: z.string().max(5000).optional().default("")
  })
});

export const createMatchSchema = z.object({
  body: z.object({
    campaignId: z.number().int().positive(),
    influencerId: z.number().int().positive()
  })
});

export const createProposalSchema = z.object({
  body: z.object({
    matchId: z.number().int().positive(),
    deliverables: nonEmpty.min(3).max(500),
    amount: z.number().int().positive().max(100000000)
  })
});

export const proposalStatusSchema = z.object({
  body: z.object({
    status: z.enum(["DRAFT", "SENT", "ACCEPTED", "REJECTED"])
  }),
  params: z.object({
    id: z.string().regex(/^\d+$/)
  })
});
