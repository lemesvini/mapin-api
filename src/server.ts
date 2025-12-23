import fastify from "fastify";
import cors from "@fastify/cors";
import prisma from "./config/database";
import jwt from "@fastify/jwt";
import { authRoutes } from "./routes/auth.routes";

const app = fastify({
  logger: true,
  disableRequestLogging: false,
});

app.register(cors, {
  origin: true, // Ajustar em produção
});

app.get("/health", async () => {
  return { status: "ok" };
});
app.get("/db", async () => {
  const userCount = await prisma.user.count();
  return { db_connection: "ok", userCount };
});
app.register(jwt, {
  secret: process.env.JWT_SECRET || "fallback-secret",
});

app.register(authRoutes, { prefix: "/auth" });
const start = async () => {
  try {
    const port = Number(process.env.PORT) || 3333;
    await app.listen({ port, host: "0.0.0.0" });
    console.log(`🚀 Server running on http://localhost:${port}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

start();
