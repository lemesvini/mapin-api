import { FastifyInstance } from "fastify";
import { AuthController } from "../controllers/auth.controller";
import { authenticate } from "../middlewares/auth";

const authController = new AuthController();

export async function authRoutes(app: FastifyInstance) {
  app.post<{
    Body: {
      email: string;
      username: string;
      fullName: string;
      password: string;
    };
  }>("/register", authController.register);

  app.post<{
    Body: { email: string; password: string };
  }>("/login", authController.login);

  app.get("/me", { onRequest: [authenticate] }, authController.me);

  app.patch<{
    Body: {
      bio?: string;
      profilePictureUrl?: string;
      fullName?: string;
      instagramUsername?: string;
    };
  }>("/me", { onRequest: [authenticate] }, authController.updateProfile);
}
