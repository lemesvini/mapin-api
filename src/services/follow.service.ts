import prisma from "../config/database";
import { Prisma } from "@prisma/client";

export class FollowService {
  /**
   * Follow a user (or send follow request if private)
   */
  async followUser(followerId: string, followingId: string) {
    // Check if trying to follow self
    if (followerId === followingId) {
      throw new Error("You cannot follow yourself");
    }

    // Check if already following
    const existingFollow = await prisma.follow.findUnique({
      where: {
        followerId_followingId: {
          followerId,
          followingId,
        },
      },
    });

    if (existingFollow) {
      throw new Error("Already following this user");
    }

    // Check if user is private
    const targetUser = await prisma.user.findUnique({
      where: { id: followingId },
      select: { isPrivate: true },
    });

    if (!targetUser) {
      throw new Error("User not found");
    }

    // If user is private, create a follow request
    if (targetUser.isPrivate) {
      // Check if request already exists
      const existingRequest = await prisma.followRequest.findUnique({
        where: {
          senderId_receiverId: {
            senderId: followerId,
            receiverId: followingId,
          },
        },
      });

      if (existingRequest) {
        if (existingRequest.status === "PENDING") {
          throw new Error("Follow request already pending");
        } else if (existingRequest.status === "REJECTED") {
          // Update existing rejected request to pending
          const request = await prisma.followRequest.update({
            where: { id: existingRequest.id },
            data: { status: "PENDING" },
            include: {
              receiver: {
                select: {
                  id: true,
                  username: true,
                  fullName: true,
                  profilePictureUrl: true,
                  isPrivate: true,
                },
              },
            },
          });
          return { type: "request", request };
        }
      }

      const request = await prisma.followRequest.create({
        data: {
          senderId: followerId,
          receiverId: followingId,
        },
        include: {
          receiver: {
            select: {
              id: true,
              username: true,
              fullName: true,
              profilePictureUrl: true,
              isPrivate: true,
            },
          },
        },
      });

      return { type: "request", request };
    }

    // If user is public, directly create follow relationship
    const follow = await prisma.follow.create({
      data: {
        followerId,
        followingId,
      },
      include: {
        following: {
          select: {
            id: true,
            username: true,
            fullName: true,
            profilePictureUrl: true,
            isPrivate: true,
          },
        },
      },
    });

    return { type: "follow", follow };
  }

  /**
   * Unfollow a user
   */
  async unfollowUser(followerId: string, followingId: string) {
    const follow = await prisma.follow.findUnique({
      where: {
        followerId_followingId: {
          followerId,
          followingId,
        },
      },
    });

    if (!follow) {
      throw new Error("Not following this user");
    }

    await prisma.follow.delete({
      where: { id: follow.id },
    });

    return true;
  }

  /**
   * Remove a follower
   */
  async removeFollower(userId: string, followerId: string) {
    const follow = await prisma.follow.findUnique({
      where: {
        followerId_followingId: {
          followerId,
          followingId: userId,
        },
      },
    });

    if (!follow) {
      throw new Error("User is not following you");
    }

    await prisma.follow.delete({
      where: { id: follow.id },
    });

    return true;
  }

  /**
   * Cancel a follow request (sender cancels)
   */
  async cancelFollowRequest(senderId: string, receiverId: string) {
    const request = await prisma.followRequest.findUnique({
      where: {
        senderId_receiverId: {
          senderId,
          receiverId,
        },
      },
    });

    if (!request) {
      throw new Error("Follow request not found");
    }

    if (request.status !== "PENDING") {
      throw new Error("Can only cancel pending requests");
    }

    await prisma.followRequest.delete({
      where: { id: request.id },
    });

    return true;
  }

  /**
   * Accept a follow request
   */
  async acceptFollowRequest(receiverId: string, requestId: string) {
    const request = await prisma.followRequest.findUnique({
      where: { id: requestId },
    });

    if (!request) {
      throw new Error("Follow request not found");
    }

    if (request.receiverId !== receiverId) {
      throw new Error("Unauthorized");
    }

    if (request.status !== "PENDING") {
      throw new Error("Request is not pending");
    }

    // Create follow relationship and update request in a transaction
    const [follow] = await prisma.$transaction([
      prisma.follow.create({
        data: {
          followerId: request.senderId,
          followingId: request.receiverId,
        },
        include: {
          follower: {
            select: {
              id: true,
              username: true,
              fullName: true,
              profilePictureUrl: true,
              isPrivate: true,
            },
          },
        },
      }),
      prisma.followRequest.update({
        where: { id: requestId },
        data: { status: "ACCEPTED" },
      }),
    ]);

    return follow;
  }

  /**
   * Reject a follow request
   */
  async rejectFollowRequest(receiverId: string, requestId: string) {
    const request = await prisma.followRequest.findUnique({
      where: { id: requestId },
    });

    if (!request) {
      throw new Error("Follow request not found");
    }

    if (request.receiverId !== receiverId) {
      throw new Error("Unauthorized");
    }

    if (request.status !== "PENDING") {
      throw new Error("Request is not pending");
    }

    await prisma.followRequest.update({
      where: { id: requestId },
      data: { status: "REJECTED" },
    });

    return true;
  }

  /**
   * Get followers of a user
   */
  async getFollowers(
    userId: string,
    params: { limit?: number; offset?: number } = {}
  ) {
    const { limit = 50, offset = 0 } = params;

    const [followers, total] = await Promise.all([
      prisma.follow.findMany({
        where: { followingId: userId },
        include: {
          follower: {
            select: {
              id: true,
              username: true,
              fullName: true,
              profilePictureUrl: true,
              bio: true,
              isPrivate: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: offset,
      }),
      prisma.follow.count({
        where: { followingId: userId },
      }),
    ]);

    return {
      followers: followers.map((f) => f.follower),
      total,
    };
  }

  /**
   * Get users that a user is following
   */
  async getFollowing(
    userId: string,
    params: { limit?: number; offset?: number } = {}
  ) {
    const { limit = 50, offset = 0 } = params;

    const [following, total] = await Promise.all([
      prisma.follow.findMany({
        where: { followerId: userId },
        include: {
          following: {
            select: {
              id: true,
              username: true,
              fullName: true,
              profilePictureUrl: true,
              bio: true,
              isPrivate: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: offset,
      }),
      prisma.follow.count({
        where: { followerId: userId },
      }),
    ]);

    return {
      following: following.map((f) => f.following),
      total,
    };
  }

  /**
   * Get pending follow requests (received)
   */
  async getPendingRequests(
    userId: string,
    params: { limit?: number; offset?: number } = {}
  ) {
    const { limit = 50, offset = 0 } = params;

    const [requests, total] = await Promise.all([
      prisma.followRequest.findMany({
        where: {
          receiverId: userId,
          status: "PENDING",
        },
        include: {
          sender: {
            select: {
              id: true,
              username: true,
              fullName: true,
              profilePictureUrl: true,
              bio: true,
              isPrivate: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: offset,
      }),
      prisma.followRequest.count({
        where: {
          receiverId: userId,
          status: "PENDING",
        },
      }),
    ]);

    return { requests, total };
  }

  /**
   * Get sent follow requests
   */
  async getSentRequests(
    userId: string,
    params: { limit?: number; offset?: number } = {}
  ) {
    const { limit = 50, offset = 0 } = params;

    const [requests, total] = await Promise.all([
      prisma.followRequest.findMany({
        where: {
          senderId: userId,
          status: "PENDING",
        },
        include: {
          receiver: {
            select: {
              id: true,
              username: true,
              fullName: true,
              profilePictureUrl: true,
              bio: true,
              isPrivate: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: offset,
      }),
      prisma.followRequest.count({
        where: {
          senderId: userId,
          status: "PENDING",
        },
      }),
    ]);

    return { requests, total };
  }

  /**
   * Check if user is following another user
   */
  async isFollowing(followerId: string, followingId: string) {
    const follow = await prisma.follow.findUnique({
      where: {
        followerId_followingId: {
          followerId,
          followingId,
        },
      },
    });

    return !!follow;
  }

  /**
   * Check follow request status
   */
  async getFollowRequestStatus(senderId: string, receiverId: string) {
    const request = await prisma.followRequest.findUnique({
      where: {
        senderId_receiverId: {
          senderId,
          receiverId,
        },
      },
    });

    return request?.status || null;
  }

  /**
   * Get follower and following counts
   */
  async getFollowCounts(userId: string) {
    const [followersCount, followingCount] = await Promise.all([
      prisma.follow.count({
        where: { followingId: userId },
      }),
      prisma.follow.count({
        where: { followerId: userId },
      }),
    ]);

    return {
      followersCount,
      followingCount,
    };
  }
}

