import Fastify, { type FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import cookie from "@fastify/cookie";
import rateLimit from "@fastify/rate-limit";
import { env } from "./env.js";
import { publicRoutes } from "./routes/public.js";
import { submissionRoutes } from "./routes/submissions.js";
import { adminRoutes } from "./routes/admin.js";
import { authRoutes } from "./routes/auth.js";
import { editRoutes } from "./routes/edits.js";

export type BuildAppOptions = {
  logger?: boolean;
  rateLimit?: boolean;
};

export async function buildApp(
  options: BuildAppOptions = {},
): Promise<FastifyInstance> {
  const app = Fastify({
    logger: options.logger ?? true,
    trustProxy: true,
  });

  await app.register(cors, {
    origin: env.CORS_ORIGIN.split(",").map((o) => o.trim()),
    credentials: true,
  });

  await app.register(cookie);

  if (options.rateLimit !== false) {
    await app.register(rateLimit, {
      global: false,
      max: 100,
      timeWindow: "1 minute",
    });
  }

  app.get("/health", async () => ({ ok: true }));

  await app.register(authRoutes);
  await app.register(publicRoutes);
  await app.register(submissionRoutes);
  await app.register(editRoutes);
  await app.register(adminRoutes);

  return app;
}
