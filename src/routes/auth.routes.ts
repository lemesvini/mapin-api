import { FastifyInstance } from "fastify";
import { AuthController } from "../controllers/auth.controller";
import { authenticate } from "../middlewares/auth";

const authController = new AuthController();

export async function authRoutes(app: FastifyInstance) {
  app.post("/register", authController.register);
  app.post("/login", authController.login);
  app.get("/me", {
    onRequest: [authenticate],
    handler: async (request, reply) => authController.me(request as any, reply),
  });
  app.patch("/me", {
    onRequest: [authenticate],
    handler: async (request, reply) =>
      authController.updateProfile(request as any, reply),
  });
}
