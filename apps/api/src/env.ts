import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  ADMIN_TOKEN: z.string().min(8),
  CORS_ORIGIN: z.string().default("http://localhost:5173"),
  PORT: z.coerce.number().default(3000),
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
  GITHUB_CLIENT_ID: z.string().min(1).optional(),
  GITHUB_CLIENT_SECRET: z.string().min(1).optional(),
  GITHUB_OAUTH_CALLBACK_URL: z.string().url().optional(),
  WEB_URL: z.string().url().default("http://localhost:5173"),
  SESSION_SECRET: z.string().min(16).optional(),
  RESEND_API_KEY: z.string().min(1).optional(),
  NOTIFICATION_EMAIL: z.string().email().optional(),
  NOTIFICATION_FROM: z
    .string()
    .default("Flutter Conferences <onboarding@resend.dev>"),
});

export const env = envSchema.parse(process.env);
