import { FastifyInstance } from "fastify";
import { UserController } from "../controllers/user.controller";
import { authenticate, optionalAuthenticate } from "../middlewares/auth";

const userController = new UserController();

export async function userRoutes(app: FastifyInstance) {
  // Public routes with optional auth - specific routes must come before parameterized routes
  app.get("/", {
    onRequest: [optionalAuthenticate],
    handler: async (request, reply) =>
      userController.getAllUsers(request as any, reply),
  });

  app.get("/search", {
    onRequest: [optionalAuthenticate],
    handler: async (request, reply) =>
      userController.searchUsers(request as any, reply),
  });

  app.get("/:userId/followers", async (request, reply) =>
    userController.getFollowers(request as any, reply)
  );
  app.get("/:userId/following", async (request, reply) =>
    userController.getFollowing(request as any, reply)
  );

  // This must come last as it's a catch-all for usernames
  app.get("/:username", {
    onRequest: [optionalAuthenticate],
    handler: async (request, reply) =>
      userController.getUserProfile(request as any, reply),
  });

  // Protected routes - follow/unfollow
  app.post("/:userId/follow", {
    onRequest: [authenticate],
    handler: async (request, reply) =>
      userController.followUser(request as any, reply),
  });
  app.delete("/:userId/follow", {
    onRequest: [authenticate],
    handler: async (request, reply) =>
      userController.unfollowUser(request as any, reply),
  });
  app.delete("/:userId/follower", {
    onRequest: [authenticate],
    handler: async (request, reply) =>
      userController.removeFollower(request as any, reply),
  });

  // Protected routes - follow requests
  app.delete("/:userId/follow-request", {
    onRequest: [authenticate],
    handler: async (request, reply) =>
      userController.cancelFollowRequest(request as any, reply),
  });
  app.post("/follow-requests/:requestId/accept", {
    onRequest: [authenticate],
    handler: async (request, reply) =>
      userController.acceptFollowRequest(request as any, reply),
  });
  app.post("/follow-requests/:requestId/reject", {
    onRequest: [authenticate],
    handler: async (request, reply) =>
      userController.rejectFollowRequest(request as any, reply),
  });
  app.get("/follow-requests/pending", {
    onRequest: [authenticate],
    handler: async (request, reply) =>
      userController.getPendingRequests(request as any, reply),
  });
  app.get("/follow-requests/sent", {
    onRequest: [authenticate],
    handler: async (request, reply) =>
      userController.getSentRequests(request as any, reply),
  });
}
