import { FastifyReply, FastifyRequest } from "fastify";
import { PinService } from "../services/pin.service";

const pinService = new PinService();

export class PinController {
  createPin = async (
    request: FastifyRequest<{
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
    }>,
    reply: FastifyReply
  ) => {
    try {
      const userId = request.user.id;
      const { lat, lng, content, moodScale, feeling, isPublic, eventId, mediaUrls } =
        request.body;

      // Validate required fields
      if (lat === undefined || lng === undefined || !content) {
        return reply.status(400).send({
          error: "lat, lng, and content are required",
        });
      }

      // Validate coordinates
      if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
        return reply.status(400).send({
          error: "Invalid coordinates",
        });
      }

      // Validate mood scale if provided
      if (moodScale !== undefined && (moodScale < 1 || moodScale > 10)) {
        return reply.status(400).send({
          error: "Mood scale must be between 1 and 10",
        });
      }

      const pin = await pinService.createPin({
        authorId: userId,
        lat,
        lng,
        content,
        moodScale,
        feeling,
        isPublic: isPublic ?? false,
        eventId,
        mediaUrls,
      });

      return reply.status(201).send({ pin });
    } catch (error: any) {
      request.log.error(error);
      return reply.status(500).send({
        error: "Internal server error",
      });
    }
  };

  getPin = async (
    request: FastifyRequest<{
      Params: { id: string };
    }>,
    reply: FastifyReply
  ) => {
    try {
      const userId = request.user?.id;
      const { id } = request.params;

      const pin = await pinService.getPinById(id, userId);

      if (!pin) {
        return reply.status(404).send({
          error: "Pin not found or you don't have access to it",
        });
      }

      return reply.status(200).send({ pin });
    } catch (error: any) {
      request.log.error(error);
      return reply.status(500).send({
        error: "Internal server error",
      });
    }
  }

  getPins = async (
    request: FastifyRequest<{
      Querystring: {
        authorId?: string;
        lat?: string;
        lng?: string;
        radius?: string;
        isPublic?: string;
        limit?: string;
        offset?: string;
      };
    }>,
    reply: FastifyReply
  ) => {
    try {
      const userId = request.user?.id;
      const { authorId, lat, lng, radius, isPublic, limit, offset } =
        request.query;

      const result = await pinService.getPins({
        authorId,
        lat: lat ? parseFloat(lat) : undefined,
        lng: lng ? parseFloat(lng) : undefined,
        radius: radius ? parseFloat(radius) : undefined,
        isPublic: isPublic === "true" ? true : isPublic === "false" ? false : undefined,
        limit: limit ? parseInt(limit) : undefined,
        offset: offset ? parseInt(offset) : undefined,
        requestingUserId: userId,
      });

      return reply.status(200).send(result);
    } catch (error: any) {
      request.log.error(error);
      return reply.status(500).send({
        error: "Internal server error",
      });
    }
  }

  updatePin = async (
    request: FastifyRequest<{
      Params: { id: string };
      Body: {
        content?: string;
        moodScale?: number;
        feeling?: string;
        isPublic?: boolean;
      };
    }>,
    reply: FastifyReply
  ) => {
    try {
      const userId = request.user.id;
      const { id } = request.params;
      const { content, moodScale, feeling, isPublic } = request.body;

      // Validate mood scale if provided
      if (moodScale !== undefined && (moodScale < 1 || moodScale > 10)) {
        return reply.status(400).send({
          error: "Mood scale must be between 1 and 10",
        });
      }

      const pin = await pinService.updatePin(id, userId, {
        content,
        moodScale,
        feeling,
        isPublic,
      });

      if (!pin) {
        return reply.status(404).send({
          error: "Pin not found or you don't have permission to update it",
        });
      }

      return reply.status(200).send({ pin });
    } catch (error: any) {
      request.log.error(error);
      return reply.status(500).send({
        error: "Internal server error",
      });
    }
  }

  deletePin = async (
    request: FastifyRequest<{
      Params: { id: string };
    }>,
    reply: FastifyReply
  ) => {
    try {
      const userId = request.user.id;
      const { id } = request.params;

      const success = await pinService.deletePin(id, userId);

      if (!success) {
        return reply.status(404).send({
          error: "Pin not found or you don't have permission to delete it",
        });
      }

      return reply.status(200).send({ message: "Pin deleted successfully" });
    } catch (error: any) {
      request.log.error(error);
      return reply.status(500).send({
        error: "Internal server error",
      });
    }
  };

  likePin = async (
    request: FastifyRequest<{
      Params: { id: string };
    }>,
    reply: FastifyReply
  ) => {
    try {
      const userId = request.user.id;
      const { id } = request.params;

      const like = await pinService.likePin(id, userId);

      if (!like) {
        return reply.status(400).send({
          error: "Pin already liked",
        });
      }

      return reply.status(201).send({ like });
    } catch (error: any) {
      request.log.error(error);
      return reply.status(500).send({
        error: "Internal server error",
      });
    }
  };

  unlikePin = async (
    request: FastifyRequest<{
      Params: { id: string };
    }>,
    reply: FastifyReply
  ) => {
    try {
      const userId = request.user.id;
      const { id } = request.params;

      const success = await pinService.unlikePin(id, userId);

      if (!success) {
        return reply.status(404).send({
          error: "Like not found",
        });
      }

      return reply.status(200).send({ message: "Pin unliked successfully" });
    } catch (error: any) {
      request.log.error(error);
      return reply.status(500).send({
        error: "Internal server error",
      });
    }
  };

  addComment = async (
    request: FastifyRequest<{
      Params: { id: string };
      Body: {
        content: string;
      };
    }>,
    reply: FastifyReply
  ) => {
    try {
      const userId = request.user.id;
      const { id } = request.params;
      const { content } = request.body;

      if (!content || content.trim().length === 0) {
        return reply.status(400).send({
          error: "Comment content is required",
        });
      }

      const comment = await pinService.addComment(id, userId, content);

      return reply.status(201).send({ comment });
    } catch (error: any) {
      request.log.error(error);
      return reply.status(500).send({
        error: "Internal server error",
      });
    }
  };

  getComments = async (
    request: FastifyRequest<{
      Params: { id: string };
      Querystring: {
        limit?: string;
        offset?: string;
      };
    }>,
    reply: FastifyReply
  ) => {
    try {
      const { id } = request.params;
      const { limit, offset } = request.query;

      const result = await pinService.getComments(
        id,
        limit ? parseInt(limit) : undefined,
        offset ? parseInt(offset) : undefined
      );

      return reply.status(200).send(result);
    } catch (error: any) {
      request.log.error(error);
      return reply.status(500).send({
        error: "Internal server error",
      });
    }
  };

  deleteComment = async (
    request: FastifyRequest<{
      Params: { id: string; commentId: string };
    }>,
    reply: FastifyReply
  ) => {
    try {
      const userId = request.user.id;
      const { commentId } = request.params;

      const success = await pinService.deleteComment(commentId, userId);

      if (!success) {
        return reply.status(404).send({
          error: "Comment not found or you don't have permission to delete it",
        });
      }

      return reply.status(200).send({ message: "Comment deleted successfully" });
    } catch (error: any) {
      request.log.error(error);
      return reply.status(500).send({
        error: "Internal server error",
      });
    }
  };

  getLikes = async (
    request: FastifyRequest<{
      Params: { id: string };
      Querystring: {
        limit?: string;
        offset?: string;
      };
    }>,
    reply: FastifyReply
  ) => {
    try {
      const { id } = request.params;
      const { limit, offset } = request.query;

      const result = await pinService.getLikes(
        id,
        limit ? parseInt(limit) : undefined,
        offset ? parseInt(offset) : undefined
      );

      return reply.status(200).send(result);
    } catch (error: any) {
      request.log.error(error);
      return reply.status(500).send({
        error: "Internal server error",
      });
    }
  };
}

