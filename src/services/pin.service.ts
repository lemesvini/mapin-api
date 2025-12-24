import prisma from "../config/database";
import { Prisma } from "@prisma/client";

export class PinService {
  async createPin(data: {
    authorId: string;
    lat: number;
    lng: number;
    content: string;
    moodScale?: number;
    feeling?: string;
    isPublic?: boolean;
    eventId?: string;
    mediaUrls?: { url: string; type: "IMAGE" | "VIDEO" }[];
  }) {
    const { mediaUrls, ...pinData } = data;

    const pin = await prisma.pin.create({
      data: {
        ...pinData,
        media: mediaUrls
          ? {
              create: mediaUrls.map((media, index) => ({
                url: media.url,
                type: media.type,
                order: index,
              })),
            }
          : undefined,
      },
      include: {
        author: {
          select: {
            id: true,
            username: true,
            fullName: true,
            profilePictureUrl: true,
          },
        },
        media: {
          orderBy: {
            order: "asc",
          },
        },
        _count: {
          select: {
            likes: true,
            comments: true,
          },
        },
      },
    });

    return pin;
  }

  async getPinById(pinId: string, userId?: string) {
    const pin = await prisma.pin.findUnique({
      where: { id: pinId },
      include: {
        author: {
          select: {
            id: true,
            username: true,
            fullName: true,
            profilePictureUrl: true,
            isPrivate: true,
          },
        },
        media: {
          orderBy: {
            order: "asc",
          },
        },
        _count: {
          select: {
            likes: true,
            comments: true,
          },
        },
        likes: userId
          ? {
              where: {
                userId: userId,
              },
              select: {
                id: true,
              },
            }
          : false,
      },
    });

    if (!pin) {
      return null;
    }

    // Check if user has access to this pin
    if (!pin.isPublic && userId !== pin.authorId) {
      // If pin is private, check if the requesting user follows the author
      if (userId) {
        const isFollowing = await prisma.follow.findUnique({
          where: {
            followerId_followingId: {
              followerId: userId,
              followingId: pin.authorId,
            },
          },
        });

        if (!isFollowing) {
          return null;
        }
      } else {
        return null;
      }
    }

    return {
      ...pin,
      isLiked: userId ? pin.likes.length > 0 : false,
      likes: undefined,
    };
  }

  async getPins(params: {
    userId?: string;
    authorId?: string;
    lat?: number;
    lng?: number;
    radius?: number; // in kilometers
    isPublic?: boolean;
    limit?: number;
    offset?: number;
    requestingUserId?: string;
  }) {
    const {
      userId,
      authorId,
      lat,
      lng,
      radius,
      isPublic,
      limit = 50,
      offset = 0,
      requestingUserId,
    } = params;

    const where: Prisma.PinWhereInput = {};

    if (authorId) {
      where.authorId = authorId;
      // If requesting pins from a specific author, check privacy
      if (requestingUserId !== authorId) {
        const author = await prisma.user.findUnique({
          where: { id: authorId },
        });

        if (author?.isPrivate) {
          // Check if requesting user follows the author
          const isFollowing = requestingUserId
            ? await prisma.follow.findUnique({
                where: {
                  followerId_followingId: {
                    followerId: requestingUserId,
                    followingId: authorId,
                  },
                },
              })
            : null;

          if (!isFollowing) {
            console.log(
              `[PinService] Private user ${authorId} - requestingUserId: ${requestingUserId}, isFollowing: ${!!isFollowing}`
            );
            return { pins: [], total: 0 };
          }
        }
      } else {
        console.log(`[PinService] User viewing own pins: ${authorId}`);
      }
    }

    if (isPublic !== undefined) {
      where.isPublic = isPublic;
    }

    // For location-based queries, we'll get all pins and filter in memory
    // In production, you'd want to use PostGIS or similar
    const pins = await prisma.pin.findMany({
      where,
      include: {
        author: {
          select: {
            id: true,
            username: true,
            fullName: true,
            profilePictureUrl: true,
          },
        },
        media: {
          orderBy: {
            order: "asc",
          },
          take: 1, // Just get the first media for list view
        },
        _count: {
          select: {
            likes: true,
            comments: true,
          },
        },
        likes: requestingUserId
          ? {
              where: {
                userId: requestingUserId,
              },
              select: {
                id: true,
              },
            }
          : false,
      },
      orderBy: {
        createdAt: "desc",
      },
      take: limit,
      skip: offset,
    });

    // Filter by location if coordinates provided
    let filteredPins = pins;
    if (lat !== undefined && lng !== undefined && radius !== undefined) {
      filteredPins = pins.filter((pin: (typeof pins)[number]) => {
        const distance = this.calculateDistance(lat, lng, pin.lat, pin.lng);
        return distance <= radius;
      });
    }

    const pinsWithLikeStatus = filteredPins.map(
      (pin: (typeof pins)[number]) => ({
        ...pin,
        isLiked: requestingUserId ? pin.likes.length > 0 : false,
        likes: undefined,
      })
    );

    const total = await prisma.pin.count({ where });

    console.log(
      `[PinService] Query result - found ${pins.length} pins, total: ${total}, where:`,
      JSON.stringify(where)
    );

    return { pins: pinsWithLikeStatus, total };
  }

  async updatePin(
    pinId: string,
    userId: string,
    data: {
      content?: string;
      moodScale?: number;
      feeling?: string;
      isPublic?: boolean;
    }
  ) {
    // Check if user owns the pin
    const pin = await prisma.pin.findUnique({
      where: { id: pinId },
    });

    if (!pin || pin.authorId !== userId) {
      return null;
    }

    const updatedPin = await prisma.pin.update({
      where: { id: pinId },
      data,
      include: {
        author: {
          select: {
            id: true,
            username: true,
            fullName: true,
            profilePictureUrl: true,
          },
        },
        media: {
          orderBy: {
            order: "asc",
          },
        },
        _count: {
          select: {
            likes: true,
            comments: true,
          },
        },
      },
    });

    return updatedPin;
  }

  async deletePin(pinId: string, userId: string) {
    // Check if user owns the pin
    const pin = await prisma.pin.findUnique({
      where: { id: pinId },
    });

    if (!pin || pin.authorId !== userId) {
      return false;
    }

    await prisma.pin.delete({
      where: { id: pinId },
    });

    return true;
  }

  async likePin(pinId: string, userId: string) {
    try {
      const like = await prisma.like.create({
        data: {
          pinId,
          userId,
        },
      });
      return like;
    } catch (error: any) {
      // If already liked (unique constraint violation)
      if (error.code === "P2002") {
        return null;
      }
      throw error;
    }
  }

  async unlikePin(pinId: string, userId: string) {
    try {
      await prisma.like.delete({
        where: {
          pinId_userId: {
            pinId,
            userId,
          },
        },
      });
      return true;
    } catch (error) {
      return false;
    }
  }

  async addComment(pinId: string, userId: string, content: string) {
    const comment = await prisma.comment.create({
      data: {
        pinId,
        authorId: userId,
        content,
      },
      include: {
        author: {
          select: {
            id: true,
            username: true,
            fullName: true,
            profilePictureUrl: true,
          },
        },
      },
    });

    return comment;
  }

  async getComments(pinId: string, limit = 50, offset = 0) {
    const comments = await prisma.comment.findMany({
      where: { pinId },
      include: {
        author: {
          select: {
            id: true,
            username: true,
            fullName: true,
            profilePictureUrl: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
      take: limit,
      skip: offset,
    });

    const total = await prisma.comment.count({
      where: { pinId },
    });

    return { comments, total };
  }

  async deleteComment(commentId: string, userId: string) {
    const comment = await prisma.comment.findUnique({
      where: { id: commentId },
      include: {
        pin: true,
      },
    });

    if (!comment) {
      return false;
    }

    // User can delete their own comment or if they own the pin
    if (comment.authorId !== userId && comment.pin.authorId !== userId) {
      return false;
    }

    await prisma.comment.delete({
      where: { id: commentId },
    });

    return true;
  }

  async getLikes(pinId: string, limit = 50, offset = 0) {
    const likes = await prisma.like.findMany({
      where: { pinId },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            fullName: true,
            profilePictureUrl: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
      take: limit,
      skip: offset,
    });

    const total = await prisma.like.count({
      where: { pinId },
    });

    return { likes, total };
  }

  // Helper function to calculate distance between two coordinates
  private calculateDistance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
  ): number {
    const R = 6371; // Radius of the Earth in kilometers
    const dLat = this.deg2rad(lat2 - lat1);
    const dLon = this.deg2rad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.deg2rad(lat1)) *
        Math.cos(this.deg2rad(lat2)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c;
    return distance;
  }

  private deg2rad(deg: number): number {
    return deg * (Math.PI / 180);
  }
}
