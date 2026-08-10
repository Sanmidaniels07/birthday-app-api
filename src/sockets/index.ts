import type { Server as HttpServer } from "node:http";
import { Server } from "socket.io";
import { env } from "../config/env.js";
import { logger } from "../lib/logger.js";
import { prisma } from "../lib/prisma.js";
import { verifyAccessToken } from "../modules/auth/auth.tokens.js";
import { SocketEvents } from "./events.js";

/** userId → live socket ids. One instance's view of presence. */
const presence = new Map<string, Set<string>>();

export function isOnline(userId: string): boolean {
  return (presence.get(userId)?.size ?? 0) > 0;
}

let io: Server | null = null;

/** The one handle the rest of the app uses to emit. Null until initSockets. */
export function getIO(): Server {
  if (!io)
    throw new Error(
      "Socket.IO not initialized — initSockets(server) must run at boot",
    );
  return io;
}

async function broadcastPresence(
  userId: string,
  online: boolean,
): Promise<void> {
  const profile = await prisma.profile.findUnique({
    where: { userId },
    select: { showOnlineStatus: true },
  });
  if (!profile?.showOnlineStatus) return; // hidden or no profile → silence

  const friendships = await prisma.friendship.findMany({
    where: {
      status: "ACCEPTED",
      OR: [{ requesterId: userId }, { addresseeId: userId }],
    },
    select: { requesterId: true, addresseeId: true },
  });
  const friendIds = friendships.map((f) =>
    f.requesterId === userId ? f.addresseeId : f.requesterId,
  );
  for (const friendId of friendIds) {
    getIO()
      .to(`user:${friendId}`)
      .emit(SocketEvents.PRESENCE_CHANGED, { userId, online });
  }
}

export function initSockets(server: HttpServer): Server {
  const allowedOrigins = [...env.WEB_ORIGIN];

  if (
    env.NODE_ENV !== "production" &&
    !allowedOrigins.includes("http://localhost:3000")
  ) {
    allowedOrigins.push("http://localhost:3000");
  }

  io = new Server(server, {
    cors: {
      origin: (origin, cb) => {
        if (!origin || allowedOrigins.includes(origin)) cb(null, true);
        else cb(new Error("Not allowed by CORS"));
      },
      credentials: true,
    },
    path: "/socket.io",
  });

  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth?.token as string | undefined;
      if (!token) return next(new Error("UNAUTHORIZED"));
      const payload = verifyAccessToken(token);
      socket.data.userId = payload.sub;
      next();
    } catch {
      next(new Error("UNAUTHORIZED"));
    }
  });

  io.on("connection", async (socket) => {
    const userId = socket.data.userId as string;

    // ---- Presence in ----
    const firstSocket =
      !presence.has(userId) || presence.get(userId)!.size === 0;
    if (!presence.has(userId)) presence.set(userId, new Set());
    presence.get(userId)!.add(socket.id);
    if (firstSocket) {
      void broadcastPresence(userId, true).catch((err) =>
        logger.error({ err, userId }, "presence broadcast failed"),
      );
    }

    // ---- Rooms: personal + every conversation I'm in ----
    await socket.join(`user:${userId}`);
    const memberships = await prisma.conversationParticipant.findMany({
      where: { userId, leftAt: null },
      select: { conversationId: true },
    });
    await Promise.all(
      memberships.map((m) => socket.join(`conversation:${m.conversationId}`)),
    );

    logger.debug({ userId, socketId: socket.id }, "socket connected");

    // ---- Typing: pure relay, membership-checked, never persisted ----
    socket.on(
      SocketEvents.CLIENT_TYPING_START,
      async (payload: { conversationId?: string }) => {
        const conversationId = payload?.conversationId;
        if (!conversationId) return;
        // Only relay into rooms this socket actually belongs to — otherwise
        // any client could broadcast typing into arbitrary conversations.
        if (!socket.rooms.has(`conversation:${conversationId}`)) return;
        socket
          .to(`conversation:${conversationId}`)
          .emit(SocketEvents.TYPING_STARTED, {
            conversationId,
            userId,
          });
      },
    );

    socket.on(
      SocketEvents.CLIENT_TYPING_STOP,
      (payload: { conversationId?: string }) => {
        const conversationId = payload?.conversationId;
        if (!conversationId) return;
        if (!socket.rooms.has(`conversation:${conversationId}`)) return;
        socket
          .to(`conversation:${conversationId}`)
          .emit(SocketEvents.TYPING_STOPPED, {
            conversationId,
            userId,
          });
      },
    );

    // ---- Call signaling: opaque relay, membership-gated per blob ----
    socket.on(
      SocketEvents.CLIENT_CALL_SIGNAL,
      async (payload: { callId?: string; data?: unknown }) => {
        const { callId, data } = payload ?? {};
        if (!callId || data === undefined) return;
        const { canSignal } = await import("../modules/calls/calls.service.js");
        const gate = await canSignal(userId, callId);
        if (!gate.ok) return; // not your call, or call over → silence, not errors
        // Relay to the OTHER participant(s): everyone in the conversation
        // room except the sender. We never parse `data` — SDP and ICE are
        // the peers' business.
        socket
          .to(`conversation:${gate.conversationId}`)
          .emit(SocketEvents.CALL_SIGNAL, {
            callId,
            from: userId,
            data,
          });
      },
    );

    // ---- Presence out ----
    socket.on("disconnect", async () => {
      const sockets = presence.get(userId);
      sockets?.delete(socket.id);
      if (sockets && sockets.size === 0) {
        presence.delete(userId);
        void broadcastPresence(userId, false).catch((err) =>
          logger.error({ err, userId }, "presence broadcast failed"),
        );
        await prisma.user
          .update({ where: { id: userId }, data: { lastSeenAt: new Date() } })
          .catch((err) =>
            logger.error({ err, userId }, "lastSeenAt update failed"),
          );
      }
      logger.debug({ userId, socketId: socket.id }, "socket disconnected");
    });
  });

  logger.info("Socket.IO attached");
  return io;
}
