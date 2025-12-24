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
      const { email, username, fullName, password } = request.body;

      // Validate required fields
      if (!email || !username || !fullName || !password) {
        return reply.status(400).send({
          error:
            "All fields are required (email, username, fullName, password)",
        });
      }

      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return reply.status(400).send({
          error: "Invalid email format",
        });
      }

      // Validate username (alphanumeric and underscores, 3-20 chars)
      const usernameRegex = /^[a-zA-Z0-9_]{3,20}$/;
      if (!usernameRegex.test(username)) {
        return reply.status(400).send({
          error:
            "Username must be 3-20 characters long and contain only letters, numbers, and underscores",
        });
      }

      // Validate password length
      if (password.length < 6) {
        return reply.status(400).send({
          error: "Password must be at least 6 characters long",
        });
      }

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
      request.log.error(error);
      return reply.status(500).send({
        error: "Internal server error",
      });
    }
  }

  async login(
    request: FastifyRequest<{
      Body: { email: string; password: string };
    }>,
    reply: FastifyReply
  ) {
    try {
      const { email, password } = request.body;

      // Validate input
      if (!email || !password) {
        return reply.status(400).send({
          error: "Email and password are required",
        });
      }

      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return reply.status(400).send({
          error: "Invalid email format",
        });
      }

      const user = await userService.validateUser(email, password);

      if (!user) {
        return reply.status(401).send({
          error: "Invalid credentials",
        });
      }

      const token = request.server.jwt.sign({
        id: user.id,
        email: user.email,
        username: user.username,
      });

      return reply.status(200).send({
        user,
        token,
      });
    } catch (error: any) {
      request.log.error(error);
      return reply.status(500).send({
        error: "Internal server error",
      });
    }
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

  async updateProfile(
    request: FastifyRequest<{
      Body: {
        bio?: string;
        profilePictureUrl?: string;
        fullName?: string;
        instagramUsername?: string;
      };
    }>,
    reply: FastifyReply
  ) {
    try {
      const userId = request.user.id;
      const { bio, profilePictureUrl, fullName, instagramUsername } =
        request.body;

      // Validate bio length if provided
      if (bio !== undefined && bio.length > 500) {
        return reply.status(400).send({
          error: "Bio must be 500 characters or less",
        });
      }

      // Validate fullName if provided
      if (fullName !== undefined) {
        if (!fullName.trim() || fullName.length < 1) {
          return reply.status(400).send({
            error: "Full name cannot be empty",
          });
        }
        if (fullName.length > 100) {
          return reply.status(400).send({
            error: "Full name must be 100 characters or less",
          });
        }
      }

      const user = await userService.updateProfile(userId, {
        bio,
        profilePictureUrl,
        fullName,
        instagramUsername,
      });

      return reply.send({ user });
    } catch (error: any) {
      request.log.error(error);
      return reply.status(500).send({
        error: "Internal server error",
      });
    }
  }
}
