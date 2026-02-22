import dotenv from "dotenv";

dotenv.config({ path: ".env.test" });
dotenv.config();

process.env.DATABASE_URL ||= "postgresql://postgres:postgres@localhost:5433/collab_platform_test?schema=public";
process.env.JWT_SECRET ||= "test-secret";
process.env.ACCESS_TOKEN_TTL ||= "15m";
process.env.REFRESH_TOKEN_TTL_DAYS ||= "30";
process.env.CORS_ORIGIN ||= "http://localhost:5173";
process.env.AUTH_RATE_LIMIT_WINDOW_MS ||= "600000";
process.env.AUTH_RATE_LIMIT_MAX ||= "1000";
