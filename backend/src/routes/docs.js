import express from "express";

const router = express.Router();

const openApiSpec = {
  openapi: "3.0.3",
  info: {
    title: "Influencer & Brand Collaboration Platform API",
    version: "1.0.0",
    description: "Core REST API for auth, campaigns, matching, applications, proposals, payments, analytics, and admin."
  },
  servers: [{ url: "/" }],
  paths: {
    "/auth/login": {
      post: {
        summary: "Login",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: { email: { type: "string" }, password: { type: "string" } },
                required: ["email", "password"]
              }
            }
          }
        },
        responses: { 200: { description: "Logged in user" } }
      }
    },
    "/api/campaigns": {
      get: { summary: "List campaigns", responses: { 200: { description: "Campaign list" } } },
      post: { summary: "Create campaign", responses: { 201: { description: "Campaign created" } } }
    },
    "/api/matches/recommendations": {
      get: { summary: "Get ranked influencer recommendations", responses: { 200: { description: "Recommendations" } } }
    },
    "/api/applications": {
      get: { summary: "List applications", responses: { 200: { description: "Application list" } } },
      post: { summary: "Apply to campaign", responses: { 201: { description: "Application created" } } }
    },
    "/api/proposals": {
      get: { summary: "List proposals", responses: { 200: { description: "Proposal list" } } },
      post: { summary: "Create proposal", responses: { 201: { description: "Proposal created" } } }
    },
    "/api/transactions": {
      get: { summary: "List transactions", responses: { 200: { description: "Transaction list" } } },
      post: { summary: "Create held transaction", responses: { 201: { description: "Transaction created" } } }
    },
    "/api/analytics/brand": {
      get: { summary: "Brand analytics", responses: { 200: { description: "Brand metrics" } } }
    },
    "/api/analytics/influencer": {
      get: { summary: "Influencer analytics", responses: { 200: { description: "Influencer metrics" } } }
    },
    "/api/admin/overview": {
      get: { summary: "Admin overview", responses: { 200: { description: "System overview" } } }
    }
  }
};

router.get("/openapi.json", (_req, res) => {
  return res.json(openApiSpec);
});

router.get("/", (_req, res) => {
  return res.json({
    message: "OpenAPI spec available at /api/docs/openapi.json",
    openapi: "/api/docs/openapi.json"
  });
});

export default router;
