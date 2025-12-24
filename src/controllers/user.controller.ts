import { FastifyReply, FastifyRequest } from "fastify";
import { FollowService } from "../services/follow.service";
import { UserService } from "../services/user.service";

const followService = new FollowService();
const userService = new UserService();

export class UserController {
  /**
   * Get user profile by username
   */
  async getUserProfile(
    request: FastifyRequest<{ Params: { username: string } }>,
    reply: FastifyReply
  ) {
    try {
      const { username } = request.params;
      const currentUserId = request.user?.id;

      const user = await userService.findByUsername(username);

      if (!user) {
        return reply.status(404).send({ error: "User not found" });
      }

      // Get follow counts
      const counts = await followService.getFollowCounts(user.id);

      // Check if current user is following this user
      let isFollowing = false;
      let followRequestStatus = null;

      if (currentUserId && currentUserId !== user.id) {
        isFollowing = await followService.isFollowing(currentUserId, user.id);
        if (!isFollowing) {
          followRequestStatus = await followService.getFollowRequestStatus(
            currentUserId,
            user.id
          );
        }
      }

      return reply.send({
        user: {
          ...user,
          ...counts,
          isFollowing,
          followRequestStatus,
        },
      });
    } catch (error: any) {
      request.log.error(error);
      return reply.status(500).send({ error: "Internal server error" });
    }
  }

  /**
   * Follow a user
   */
  async followUser(
    request: FastifyRequest<{ Params: { userId: string } }>,
    reply: FastifyReply
  ) {
    try {
      const followerId = request.user.id;
      const { userId: followingId } = request.params;

      const result = await followService.followUser(followerId, followingId);

      if (result.type === "request") {
        return reply.status(201).send({
          message: "Follow request sent",
          request: result.request,
        });
      } else {
        return reply.status(201).send({
          message: "Successfully followed user",
          follow: result.follow,
        });
      }
    } catch (error: any) {
      if (
        error.message === "Already following this user" ||
        error.message === "Follow request already pending" ||
        error.message === "You cannot follow yourself"
      ) {
        return reply.status(400).send({ error: error.message });
      }
      if (error.message === "User not found") {
        return reply.status(404).send({ error: error.message });
      }
      request.log.error(error);
      return reply.status(500).send({ error: "Internal server error" });
    }
  }

  /**
   * Unfollow a user
   */
  async unfollowUser(
    request: FastifyRequest<{ Params: { userId: string } }>,
    reply: FastifyReply
  ) {
    try {
      const followerId = request.user.id;
      const { userId: followingId } = request.params;

      await followService.unfollowUser(followerId, followingId);

      return reply.send({ message: "Successfully unfollowed user" });
    } catch (error: any) {
      if (error.message === "Not following this user") {
        return reply.status(400).send({ error: error.message });
      }
      request.log.error(error);
      return reply.status(500).send({ error: "Internal server error" });
    }
  }

  /**
   * Remove a follower
   */
  async removeFollower(
    request: FastifyRequest<{ Params: { userId: string } }>,
    reply: FastifyReply
  ) {
    try {
      const userId = request.user.id;
      const { userId: followerId } = request.params;

      await followService.removeFollower(userId, followerId);

      return reply.send({ message: "Successfully removed follower" });
    } catch (error: any) {
      if (error.message === "User is not following you") {
        return reply.status(400).send({ error: error.message });
      }
      request.log.error(error);
      return reply.status(500).send({ error: "Internal server error" });
    }
  }

  /**
   * Cancel a follow request
   */
  async cancelFollowRequest(
    request: FastifyRequest<{ Params: { userId: string } }>,
    reply: FastifyReply
  ) {
    try {
      const senderId = request.user.id;
      const { userId: receiverId } = request.params;

      await followService.cancelFollowRequest(senderId, receiverId);

      return reply.send({ message: "Follow request cancelled" });
    } catch (error: any) {
      if (
        error.message === "Follow request not found" ||
        error.message === "Can only cancel pending requests"
      ) {
        return reply.status(400).send({ error: error.message });
      }
      request.log.error(error);
      return reply.status(500).send({ error: "Internal server error" });
    }
  }

  /**
   * Accept a follow request
   */
  async acceptFollowRequest(
    request: FastifyRequest<{ Params: { requestId: string } }>,
    reply: FastifyReply
  ) {
    try {
      const receiverId = request.user.id;
      const { requestId } = request.params;

      const follow = await followService.acceptFollowRequest(
        receiverId,
        requestId
      );

      return reply.send({
        message: "Follow request accepted",
        follow,
      });
    } catch (error: any) {
      if (
        error.message === "Follow request not found" ||
        error.message === "Request is not pending"
      ) {
        return reply.status(400).send({ error: error.message });
      }
      if (error.message === "Unauthorized") {
        return reply.status(403).send({ error: error.message });
      }
      request.log.error(error);
      return reply.status(500).send({ error: "Internal server error" });
    }
  }

  /**
   * Reject a follow request
   */
  async rejectFollowRequest(
    request: FastifyRequest<{ Params: { requestId: string } }>,
    reply: FastifyReply
  ) {
    try {
      const receiverId = request.user.id;
      const { requestId } = request.params;

      await followService.rejectFollowRequest(receiverId, requestId);

      return reply.send({ message: "Follow request rejected" });
    } catch (error: any) {
      if (
        error.message === "Follow request not found" ||
        error.message === "Request is not pending"
      ) {
        return reply.status(400).send({ error: error.message });
      }
      if (error.message === "Unauthorized") {
        return reply.status(403).send({ error: error.message });
      }
      request.log.error(error);
      return reply.status(500).send({ error: "Internal server error" });
    }
  }

  /**
   * Get followers of a user
   */
  async getFollowers(
    request: FastifyRequest<{
      Params: { userId: string };
      Querystring: { limit?: string; offset?: string };
    }>,
    reply: FastifyReply
  ) {
    try {
      const { userId } = request.params;
      const limit = request.query.limit ? parseInt(request.query.limit) : 50;
      const offset = request.query.offset ? parseInt(request.query.offset) : 0;

      const result = await followService.getFollowers(userId, {
        limit,
        offset,
      });

      return reply.send(result);
    } catch (error: any) {
      request.log.error(error);
      return reply.status(500).send({ error: "Internal server error" });
    }
  }

  /**
   * Get users that a user is following
   */
  async getFollowing(
    request: FastifyRequest<{
      Params: { userId: string };
      Querystring: { limit?: string; offset?: string };
    }>,
    reply: FastifyReply
  ) {
    try {
      const { userId } = request.params;
      const limit = request.query.limit ? parseInt(request.query.limit) : 50;
      const offset = request.query.offset ? parseInt(request.query.offset) : 0;

      const result = await followService.getFollowing(userId, {
        limit,
        offset,
      });

      return reply.send(result);
    } catch (error: any) {
      request.log.error(error);
      return reply.status(500).send({ error: "Internal server error" });
    }
  }

  /**
   * Get pending follow requests (received)
   */
  async getPendingRequests(
    request: FastifyRequest<{
      Querystring: { limit?: string; offset?: string };
    }>,
    reply: FastifyReply
  ) {
    try {
      const userId = request.user.id;
      const limit = request.query.limit ? parseInt(request.query.limit) : 50;
      const offset = request.query.offset ? parseInt(request.query.offset) : 0;

      const result = await followService.getPendingRequests(userId, {
        limit,
        offset,
      });

      return reply.send(result);
    } catch (error: any) {
      request.log.error(error);
      return reply.status(500).send({ error: "Internal server error" });
    }
  }

  /**
   * Get sent follow requests
   */
  async getSentRequests(
    request: FastifyRequest<{
      Querystring: { limit?: string; offset?: string };
    }>,
    reply: FastifyReply
  ) {
    try {
      const userId = request.user.id;
      const limit = request.query.limit ? parseInt(request.query.limit) : 50;
      const offset = request.query.offset ? parseInt(request.query.offset) : 0;

      const result = await followService.getSentRequests(userId, {
        limit,
        offset,
      });

      return reply.send(result);
    } catch (error: any) {
      request.log.error(error);
      return reply.status(500).send({ error: "Internal server error" });
    }
  }

  /**
   * Get all users (for testing/development)
   */
  async getAllUsers(
    request: FastifyRequest<{
      Querystring: { limit?: string; offset?: string };
    }>,
    reply: FastifyReply
  ) {
    try {
      const limit = request.query.limit ? parseInt(request.query.limit) : 50;
      const offset = request.query.offset ? parseInt(request.query.offset) : 0;

      const result = await userService.getAllUsers(limit, offset);
      const currentUserId = request.user?.id;

      // Add follow status for each user if authenticated
      if (currentUserId) {
        const usersWithFollowStatus = await Promise.all(
          result.users.map(async (user) => {
            if (user.id === currentUserId) {
              return { ...user, isFollowing: false, followRequestStatus: null };
            }

            const isFollowing = await followService.isFollowing(
              currentUserId,
              user.id
            );

            let followRequestStatus = null;
            if (!isFollowing) {
              followRequestStatus = await followService.getFollowRequestStatus(
                currentUserId,
                user.id
              );
            }

            const counts = await followService.getFollowCounts(user.id);

            return {
              ...user,
              ...counts,
              isFollowing,
              followRequestStatus,
            };
          })
        );

        return reply.send({
          users: usersWithFollowStatus,
          total: result.total,
        });
      }

      return reply.send(result);
    } catch (error: any) {
      request.log.error(error);
      return reply.status(500).send({ error: "Internal server error" });
    }
  }

  /**
   * Search users by username or full name
   */
  async searchUsers(
    request: FastifyRequest<{
      Querystring: { q?: string; limit?: string; offset?: string };
    }>,
    reply: FastifyReply
  ) {
    try {
      const { q: query = "" } = request.query;
      const limit = request.query.limit ? parseInt(request.query.limit) : 20;
      const offset = request.query.offset ? parseInt(request.query.offset) : 0;

      if (!query.trim()) {
        return reply.send({ users: [], total: 0 });
      }

      const result = await userService.searchUsers(query, limit, offset);
      const currentUserId = request.user?.id;

      // Add follow status for each user if authenticated
      if (currentUserId) {
        const usersWithFollowStatus = await Promise.all(
          result.users.map(async (user) => {
            if (user.id === currentUserId) {
              return { ...user, isFollowing: false, followRequestStatus: null };
            }

            const isFollowing = await followService.isFollowing(
              currentUserId,
              user.id
            );

            let followRequestStatus = null;
            if (!isFollowing) {
              followRequestStatus = await followService.getFollowRequestStatus(
                currentUserId,
                user.id
              );
            }

            const counts = await followService.getFollowCounts(user.id);

            // Log for debugging
            request.log.info({
              msg: "Search follow status",
              userId: user.id,
              username: user.username,
              isFollowing,
              followRequestStatus,
            });

            return {
              ...user,
              ...counts,
              isFollowing,
              followRequestStatus,
            };
          })
        );

        return reply.send({
          users: usersWithFollowStatus,
          total: result.total,
        });
      }

      return reply.send(result);
    } catch (error: any) {
      request.log.error(error);
      return reply.status(500).send({ error: "Internal server error" });
    }
  }
}
