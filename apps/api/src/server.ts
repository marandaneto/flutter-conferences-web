import Fastify from "fastify";
import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import { env } from "./env.js";
import { publicRoutes } from "./routes/public.js";
import { submissionRoutes } from "./routes/submissions.js";
import { adminRoutes } from "./routes/admin.js";

const app = Fastify({
  logger: true,
  trustProxy: true,
});

await app.register(cors, {
  origin: env.CORS_ORIGIN.split(",").map((o) => o.trim()),
  credentials: false,
});

await app.register(rateLimit, {
  global: false,
  max: 100,
  timeWindow: "1 minute",
});

app.get("/health", async () => ({ ok: true }));

await app.register(publicRoutes);
await app.register(submissionRoutes);
await app.register(adminRoutes);

try {
  await app.listen({ port: env.PORT, host: "0.0.0.0" });
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
