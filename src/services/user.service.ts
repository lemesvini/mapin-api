import bcrypt from "bcryptjs";
import prisma from "../config/database";

export class UserService {
  async createUser(data: {
    email: string;
    username: string;
    fullName: string;
    password: string;
  }) {
    const hashedPassword = await bcrypt.hash(data.password, 10);

    const user = await prisma.user.create({
      data: {
        email: data.email,
        username: data.username,
        fullName: data.fullName,
        password: hashedPassword,
      },
      select: {
        id: true,
        email: true,
        username: true,
        fullName: true,
        createdAt: true,
      },
    });

    return user;
  }

  async validateUser(email: string, password: string) {
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) return null;

    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) return null;

    const { password: _, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }

  async findByUsername(username: string) {
    return prisma.user.findUnique({
      where: { username },
      select: {
        id: true,
        username: true,
        fullName: true,
        bio: true,
        profilePictureUrl: true,
        instagramUsername: true,
        isPrivate: true,
        createdAt: true,
      },
    });
  }

  async searchUsers(query: string, limit: number = 20, offset: number = 0) {
    const users = await prisma.user.findMany({
      where: {
        OR: [
          { username: { contains: query, mode: "insensitive" } },
          { fullName: { contains: query, mode: "insensitive" } },
        ],
      },
      select: {
        id: true,
        username: true,
        fullName: true,
        bio: true,
        profilePictureUrl: true,
        isPrivate: true,
        createdAt: true,
      },
      take: limit,
      skip: offset,
      orderBy: [{ username: "asc" }],
    });

    const total = await prisma.user.count({
      where: {
        OR: [
          { username: { contains: query, mode: "insensitive" } },
          { fullName: { contains: query, mode: "insensitive" } },
        ],
      },
    });

    return { users, total };
  }

  async getAllUsers(limit: number = 50, offset: number = 0) {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        username: true,
        fullName: true,
        bio: true,
        profilePictureUrl: true,
        isPrivate: true,
        createdAt: true,
      },
      take: limit,
      skip: offset,
      orderBy: [{ createdAt: "desc" }],
    });

    const total = await prisma.user.count();

    return { users, total };
  }

  async updateProfile(
    userId: string,
    data: {
      bio?: string;
      profilePictureUrl?: string;
      fullName?: string;
      instagramUsername?: string;
    }
  ) {
    const user = await prisma.user.update({
      where: { id: userId },
      data: {
        ...(data.bio !== undefined && { bio: data.bio }),
        ...(data.profilePictureUrl !== undefined && {
          profilePictureUrl: data.profilePictureUrl || null,
        }),
        ...(data.fullName !== undefined && { fullName: data.fullName }),
        ...(data.instagramUsername !== undefined && {
          instagramUsername: data.instagramUsername || null,
        }),
      },
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

    return user;
  }
}
