import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { PinController } from "../controllers/pin.controller";
import { authenticate, optionalAuthenticate } from "../middlewares/auth";

const pinController = new PinController();

export async function pinRoutes(app: FastifyInstance) {
  // Pin CRUD operations
  app.post<{
    Body: {
      lat: number;
      lng: number;
      content: string;
      moodScale?: number;
      feeling?: string;
      isPublic?: boolean;
      eventId?: string;
      mediaUrls?: { url: string; type: "IMAGE" | "VIDEO" }[];
    };
  }>("/", { onRequest: [authenticate] }, pinController.createPin);

  app.get<{
    Querystring: {
      authorId?: string;
      lat?: string;
      lng?: string;
      radius?: string;
      isPublic?: string;
      limit?: string;
      offset?: string;
    };
  }>("/", { onRequest: [optionalAuthenticate] }, pinController.getPins); // Can be accessed without auth for public pins, but uses auth if available

  app.get<{
    Params: { id: string };
  }>("/:id", pinController.getPin);

  app.put<{
    Params: { id: string };
    Body: {
      content?: string;
      moodScale?: number;
      feeling?: string;
      isPublic?: boolean;
    };
  }>("/:id", { onRequest: [authenticate] }, pinController.updatePin);

  app.delete<{
    Params: { id: string };
  }>("/:id", { onRequest: [authenticate] }, pinController.deletePin);

  // Like operations
  app.post<{
    Params: { id: string };
  }>("/:id/like", { onRequest: [authenticate] }, pinController.likePin);

  app.delete<{
    Params: { id: string };
  }>("/:id/like", { onRequest: [authenticate] }, pinController.unlikePin);

  app.get<{
    Params: { id: string };
    Querystring: {
      limit?: string;
      offset?: string;
    };
  }>("/:id/likes", pinController.getLikes);

  // Comment operations
  app.post<{
    Params: { id: string };
    Body: {
      content: string;
    };
  }>("/:id/comments", { onRequest: [authenticate] }, pinController.addComment);

  app.get<{
    Params: { id: string };
    Querystring: {
      limit?: string;
      offset?: string;
    };
  }>("/:id/comments", pinController.getComments);

  app.delete<{
    Params: { id: string; commentId: string };
  }>(
    "/:id/comments/:commentId",
    { onRequest: [authenticate] },
    pinController.deleteComment
  );
}
