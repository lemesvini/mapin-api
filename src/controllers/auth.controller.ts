import { FastifyReply, FastifyRequest } from "fastify";
import { UserService } from "../services/user.service";
import prisma from "../config/database";

const userService = new UserService();

export class AuthController {
  async register(
    request: FastifyRequest<{
      Body: {
        email: string;
        username: string;
        fullName: string;
        password: string;
      };
    }>,
    reply: FastifyReply
  ) {
    try {
      const user = await userService.createUser(request.body);
      const token = request.server.jwt.sign({
        id: user.id,
        email: user.email,
        username: user.username,
      });

      return reply.status(201).send({ user, token });
    } catch (error: any) {
      if (error.code === "P2002") {
        return reply.status(409).send({
          error: "Email or username already exists",
        });
      }
      throw error;
    }
  }

  async login(
    request: FastifyRequest<{
      Body: { email: string; password: string };
    }>,
    reply: FastifyReply
  ) {
    const { email, password } = request.body;

    const user = await userService.validateUser(email, password);

    if (!user) {
      return reply.status(401).send({ error: "Invalid credentials" });
    }

    const token = request.server.jwt.sign({
      id: user.id,
      email: user.email,
      username: user.username,
    });

    return { user, token };
  }

  async me(request: FastifyRequest, reply: FastifyReply) {
    const userId = request.user.id;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        username: true,
        fullName: true,
        bio: true,
        profilePictureUrl: true,
        instagramUsername: true,
        isPrivate: true,
        createdAt: true,
      },
    });

    return { user };
  }
}
