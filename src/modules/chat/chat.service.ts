import { prisma } from "../../lib/prisma.js";
import {
  BadRequestError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from "../../utils/errors.js";
import { areFriends } from "../social/social.helpers.js";
import { getIO, isOnline } from "../../sockets/index.js";
import { SocketEvents } from "../../sockets/events.js";
import { logger } from "../../lib/logger.js";
import {
  cloudinaryEnabled,
  signChatMediaUpload,
  MEDIA_ROOT,
  type ChatMediaKind,
} from "../../lib/cloudinary.js";
import type { SendMessageInput } from "./chat.schemas.js";
import { dispatch } from "../notifications/notifications.service.js";

/** Sorted pair → one DM per pair, enforced by the unique column. */
function pairKeyFor(a: string, b: string): string {
  return [a, b].sort().join(":");
}

const participantCardSelect = {
  userId: true,
  isAdmin: true,
  lastReadAt: true,
  user: {
    select: {
      profile: {
        select: {
          username: true,
          displayName: true,
          avatarUrl: true,
          blobTint: true,
        },
      },
    },
  },
} as const;

const conversationSelect = {
  id: true,
  type: true,
  title: true,
  avatarUrl: true,
  lastMessageAt: true,
  createdAt: true,
  participants: {
    where: { leftAt: null },
    select: participantCardSelect,
  },
} as const;

/** Resolve username → friend's userId, or the right 404s. */
async function resolveFriend(
  actorId: string,
  targetUsername: string,
): Promise<string> {
  const profile = await prisma.profile.findUnique({
    where: { username: targetUsername },
    select: { userId: true, user: { select: { status: true } } },
  });
  if (!profile || profile.user.status !== "ACTIVE")
    throw new NotFoundError("User");
  if (profile.userId === actorId)
    throw new BadRequestError("You cannot message yourself");
  if (!(await areFriends(actorId, profile.userId))) {
    throw new NotFoundError("User");
  }
  return profile.userId;
}

/** Make live sockets of these users join the new conversation's room. */
function joinRoomLive(conversationId: string, userIds: string[]): void {
  const io = getIO();
  for (const userId of userIds) {
    io.in(`user:${userId}`).socketsJoin(`conversation:${conversationId}`);
  }
}

export async function createOrGetDm(actorId: string, targetUsername: string) {
  const otherId = await resolveFriend(actorId, targetUsername);
  const pairKey = pairKeyFor(actorId, otherId);

  const existing = await prisma.conversation.findUnique({
    where: { pairKey },
    select: conversationSelect,
  });
  if (existing) return { conversation: existing, created: false };

  try {
    const conversation = await prisma.conversation.create({
      data: {
        type: "DIRECT",
        creatorId: actorId,
        pairKey,
        participants: {
          create: [{ userId: actorId }, { userId: otherId }],
        },
      },
      select: conversationSelect,
    });

    joinRoomLive(conversation.id, [actorId, otherId]);
    getIO()
      .to(`user:${otherId}`)
      .emit(SocketEvents.CONVERSATION_NEW, { conversation });

    return { conversation, created: true };
  } catch (err: unknown) {
    // Both friends tapped "message" simultaneously: the unique pairKey
    // arbitrates; the loser fetches the winner's thread. Pattern #5.
    if (
      typeof err === "object" &&
      err !== null &&
      "code" in err &&
      err.code === "P2002"
    ) {
      const winner = await prisma.conversation.findUnique({
        where: { pairKey },
        select: conversationSelect,
      });
      if (winner) return { conversation: winner, created: false };
    }
    throw err;
  }
}

export async function createGroup(
  actorId: string,
  title: string,
  usernames: string[],
) {
  // Every initial member must be the creator's friend; dedupe usernames.
  const memberIds = await Promise.all(
    [...new Set(usernames)].map((u) => resolveFriend(actorId, u)),
  );

  const conversation = await prisma.conversation.create({
    data: {
      type: "GROUP",
      creatorId: actorId,
      title,
      participants: {
        create: [
          { userId: actorId, isAdmin: true },
          ...memberIds.map((userId) => ({ userId })),
        ],
      },
    },
    select: conversationSelect,
  });

  joinRoomLive(conversation.id, [actorId, ...memberIds]);
  for (const memberId of memberIds) {
    getIO()
      .to(`user:${memberId}`)
      .emit(SocketEvents.CONVERSATION_NEW, { conversation });
  }

  logger.info(
    { conversationId: conversation.id, members: memberIds.length + 1 },
    "group created",
  );
  return conversation;
}

/** Load a conversation the actor is a live member of — the chat gate. */
export async function memberConversation(
  actorId: string,
  conversationId: string,
) {
  const membership = await prisma.conversationParticipant.findUnique({
    where: { conversationId_userId: { conversationId, userId: actorId } },
    select: { id: true, leftAt: true },
  });
  // Not a member, or left → the conversation does not exist for you.
  if (!membership || membership.leftAt) throw new NotFoundError("Conversation");
  return membership;
}

export async function getConversation(actorId: string, conversationId: string) {
  await memberConversation(actorId, conversationId);
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    select: conversationSelect,
  });
  if (!conversation) throw new NotFoundError("Conversation");
  return conversation;
}

export async function listInbox(
  actorId: string,
  opts: { cursor?: string; limit: number },
) {
  const rows = await prisma.conversation.findMany({
    where: { participants: { some: { userId: actorId, leftAt: null } } },
    orderBy: [
      { lastMessageAt: { sort: "desc", nulls: "last" } },
      { id: "desc" },
    ],
    take: opts.limit + 1,
    ...(opts.cursor ? { cursor: { id: opts.cursor }, skip: 1 } : {}),
    select: {
      ...conversationSelect,
      // Inbox preview: the latest live message, inline.
      messages: {
        where: { deletedAt: null },
        orderBy: { createdAt: "desc" as const },
        take: 1,
        select: {
          id: true,
          type: true,
          body: true,
          senderId: true,
          createdAt: true,
        },
      },
    },
  });

  const hasMore = rows.length > opts.limit;
  const page = hasMore ? rows.slice(0, opts.limit) : rows;
  return {
    page: page.map((c) => ({
      ...c,
      latestMessage: c.messages[0] ?? null,
      messages: undefined,
    })),
    meta: {
      cursor: hasMore ? (page[page.length - 1]?.id ?? null) : null,
      hasMore,
    },
  };
}

const messageCardSelect = {
  id: true,
  conversationId: true,
  type: true,
  body: true,
  mediaUrl: true,
  mediaDuration: true,
  mediaSize: true,
  replyToId: true,
  editedAt: true,
  deletedAt: true,
  createdAt: true,
  sender: {
    select: {
      profile: {
        select: {
          username: true,
          displayName: true,
          avatarUrl: true,
          blobTint: true,
        },
      },
    },
  },
  replyTo: {
    select: {
      id: true,
      body: true,
      deletedAt: true,
      sender: {
        select: { profile: { select: { username: true, displayName: true } } },
      },
    },
  },
} as const;

/** Deleted messages ship as placeholders — id and timestamps survive, content doesn't. */
function presentMessage(
  m: {
    deletedAt: Date | null;
    body: string | null;
    mediaUrl: string | null;
    mediaDuration: number | null;
    mediaSize: number | null;
    replyTo: { deletedAt: Date | null; body: string | null } | null;
  } & Record<string, unknown>,
) {
  const replyTo = m.replyTo
    ? { ...m.replyTo, body: m.replyTo.deletedAt ? null : m.replyTo.body }
    : null;
  if (m.deletedAt) {
    return {
      ...m,
      body: null,
      mediaUrl: null,
      mediaDuration: null,
      mediaSize: null,
      replyTo,
    };
  }
  return { ...m, replyTo };
}

export async function getChatMediaSignature(
  actorId: string,
  conversationId: string,
  kind: ChatMediaKind,
) {
  if (!cloudinaryEnabled)
    throw new BadRequestError(
      "Media uploads are not configured on this server",
    );
  await memberConversation(actorId, conversationId); // members only sign
  return signChatMediaUpload(actorId, kind);
}

/** Notify participants who are OFFLINE — online users saw message:new. */
async function notifyOfflineParticipants(
  conversationId: string,
  senderId: string,
  message: { body: string | null; type: string },
) {
  const participants = await prisma.conversationParticipant.findMany({
    where: { conversationId, leftAt: null, userId: { not: senderId } },
    select: { userId: true, mutedUntil: true },
  });
  const sender = await prisma.profile.findUnique({
    where: { userId: senderId },
    select: { displayName: true },
  });
  const preview =
    message.type === "TEXT"
      ? (message.body ?? "").slice(0, 80)
      : `Sent ${message.type.toLowerCase().replace("_", " ")}`;

  const now = new Date();
  for (const p of participants) {
    if (isOnline(p.userId)) continue; // live users have the socket
    if (p.mutedUntil && p.mutedUntil > now) continue; // muted stays quiet
    await dispatch({
      recipientId: p.userId,
      actorId: senderId,
      type: "NEW_MESSAGE",
      title: `${sender?.displayName ?? "Someone"} sent you a message`,
      body: preview,
      entityType: "conversation",
      entityId: conversationId,
    });
  }
}

export async function sendMessage(
  actorId: string,
  conversationId: string,
  input: SendMessageInput,
) {
  await memberConversation(actorId, conversationId);

  if (input.replyToId) {
    const target = await prisma.message.findUnique({
      where: { id: input.replyToId },
      select: { conversationId: true },
    });
    if (!target || target.conversationId !== conversationId) {
      throw new NotFoundError("Message");
    }
  }

  // Media messages: the claimed public id must live in MY chat namespace.
  const isMedia = input.type !== "TEXT";
  if (isMedia) {
    const prefix = `${MEDIA_ROOT}/chat/${actorId}/`;
    if (!("mediaUrl" in input) || !input.mediaUrl.startsWith(prefix)) {
      throw new BadRequestError("Unexpected media reference");
    }
  }

  const [message] = await prisma.$transaction([
    prisma.message.create({
      data: {
        conversationId,
        senderId: actorId,
        type: input.type ?? "TEXT",
        body: input.body ?? null,
        mediaUrl: isMedia && "mediaUrl" in input ? input.mediaUrl : null,
        mediaDuration:
          isMedia && "mediaDuration" in input
            ? (input.mediaDuration ?? null)
            : null,
        mediaSize: isMedia && "mediaSize" in input ? input.mediaSize : null,
        replyToId: input.replyToId ?? null,
      },
      select: messageCardSelect,
    }),
    prisma.conversation.update({
      where: { id: conversationId },
      data: { lastMessageAt: new Date() },
    }),
  ]);

  const presented = presentMessage(message);
  getIO()
    .to(`conversation:${conversationId}`)
    .emit(SocketEvents.MESSAGE_NEW, { message: presented });

  // Notify participants who are OFFLINE — online users saw message:new.
  // The socket is the live layer; notifications are the reach layer.
  void notifyOfflineParticipants(conversationId, actorId, message).catch(
    (err) => logger.error({ err }, "message notification failed"),
  );

  return presented;
}

export async function messageHistory(
  actorId: string,
  conversationId: string,
  opts: { cursor?: string; limit: number },
) {
  await memberConversation(actorId, conversationId);

  const rows = await prisma.message.findMany({
    where: { conversationId },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: opts.limit + 1,
    ...(opts.cursor ? { cursor: { id: opts.cursor }, skip: 1 } : {}),
    select: messageCardSelect,
  });

  const hasMore = rows.length > opts.limit;
  const page = hasMore ? rows.slice(0, opts.limit) : rows;
  return {
    page: page.map(presentMessage),
    meta: {
      cursor: hasMore ? (page[page.length - 1]?.id ?? null) : null,
      hasMore,
    },
  };
}

const EDIT_WINDOW_MIN = 15;

export async function editMessage(
  actorId: string,
  conversationId: string,
  messageId: string,
  body: string,
) {
  await memberConversation(actorId, conversationId);

  const message = await prisma.message.findUnique({
    where: { id: messageId },
    select: {
      id: true,
      conversationId: true,
      senderId: true,
      type: true,
      deletedAt: true,
      createdAt: true,
    },
  });
  if (
    !message ||
    message.conversationId !== conversationId ||
    message.deletedAt ||
    message.senderId !== actorId
  ) {
    throw new NotFoundError("Message");
  }
  if (message.type !== "TEXT")
    throw new BadRequestError("Only text messages can be edited");
  if (Date.now() - message.createdAt.getTime() > EDIT_WINDOW_MIN * 60_000) {
    throw new BadRequestError(
      `Messages can only be edited within ${EDIT_WINDOW_MIN} minutes`,
    );
  }

  const updated = await prisma.message.update({
    where: { id: messageId },
    data: { body, editedAt: new Date() },
    select: messageCardSelect,
  });

  const presented = presentMessage(updated);
  getIO()
    .to(`conversation:${conversationId}`)
    .emit(SocketEvents.MESSAGE_EDITED, { message: presented });
  return presented;
}

export async function deleteMessage(
  actorId: string,
  conversationId: string,
  messageId: string,
) {
  await memberConversation(actorId, conversationId);

  const message = await prisma.message.findUnique({
    where: { id: messageId },
    select: { id: true, conversationId: true, senderId: true, deletedAt: true },
  });
  if (
    !message ||
    message.conversationId !== conversationId ||
    message.deletedAt ||
    message.senderId !== actorId
  ) {
    throw new NotFoundError("Message");
  }

  await prisma.message.update({
    where: { id: messageId },
    data: { deletedAt: new Date() },
  });

  getIO()
    .to(`conversation:${conversationId}`)
    .emit(SocketEvents.MESSAGE_DELETED, { conversationId, messageId });
  return { deleted: true };
}

export async function markRead(actorId: string, conversationId: string) {
  await memberConversation(actorId, conversationId);

  const now = new Date();
  await prisma.conversationParticipant.update({
    where: { conversationId_userId: { conversationId, userId: actorId } },
    data: { lastReadAt: now },
  });

  // Announce to the room: "this person has seen up to now."
  getIO()
    .to(`conversation:${conversationId}`)
    .emit(SocketEvents.CONVERSATION_READ, {
      conversationId,
      userId: actorId,
      lastReadAt: now.toISOString(),
    });

  return { lastReadAt: now };
}

export async function unreadCounts(actorId: string) {
  const memberships = await prisma.conversationParticipant.findMany({
    where: { userId: actorId, leftAt: null },
    select: { conversationId: true, lastReadAt: true },
  });
  if (memberships.length === 0) return { total: 0, byConversation: {} };

  const counts = await Promise.all(
    memberships.map(async (m) => {
      const count = await prisma.message.count({
        where: {
          conversationId: m.conversationId,
          deletedAt: null,
          senderId: { not: actorId },
          ...(m.lastReadAt ? { createdAt: { gt: m.lastReadAt } } : {}),
        },
      });
      return [m.conversationId, count] as const;
    }),
  );

  const byConversation = Object.fromEntries(counts.filter(([, c]) => c > 0));
  const total = counts.reduce((sum, [, c]) => sum + c, 0);
  return { total, byConversation };
}

/** Write a SYSTEM message attributed to the acting user, and broadcast. */
async function systemMessage(
  conversationId: string,
  actorId: string,
  body: string,
) {
  const [message] = await prisma.$transaction([
    prisma.message.create({
      data: { conversationId, senderId: actorId, type: "SYSTEM", body },
      select: messageCardSelect,
    }),
    prisma.conversation.update({
      where: { id: conversationId },
      data: { lastMessageAt: new Date() },
    }),
  ]);
  getIO()
    .to(`conversation:${conversationId}`)
    .emit(SocketEvents.MESSAGE_NEW, { message: presentMessage(message) });
}

/** Load a GROUP conversation where the actor is a live ADMIN member. */
async function adminMembership(actorId: string, conversationId: string) {
  const membership = await prisma.conversationParticipant.findUnique({
    where: { conversationId_userId: { conversationId, userId: actorId } },
    select: {
      isAdmin: true,
      leftAt: true,
      conversation: { select: { type: true } },
    },
  });
  if (
    !membership ||
    membership.leftAt ||
    membership.conversation.type !== "GROUP"
  ) {
    throw new NotFoundError("Conversation");
  }
  if (!membership.isAdmin)
    throw new ForbiddenError("Only group admins can do this");
  return membership;
}

export async function addGroupMember(
  actorId: string,
  conversationId: string,
  targetUsername: string,
) {
  await adminMembership(actorId, conversationId);
  const newMemberId = await resolveFriend(actorId, targetUsername);

  const existing = await prisma.conversationParticipant.findUnique({
    where: { conversationId_userId: { conversationId, userId: newMemberId } },
    select: { id: true, leftAt: true },
  });

  const [names] = await Promise.all([memberNames([actorId, newMemberId])]);

  if (existing && !existing.leftAt) throw new ConflictError("Already a member");
  if (existing) {
    // Returning member: revive, history intact, unread counter reset.
    await prisma.conversationParticipant.update({
      where: { id: existing.id },
      data: {
        leftAt: null,
        joinedAt: new Date(),
        lastReadAt: null,
        isAdmin: false,
      },
    });
  } else {
    await prisma.conversationParticipant.create({
      data: { conversationId, userId: newMemberId },
    });
  }

  joinRoomLive(conversationId, [newMemberId]);
  getIO()
    .to(`user:${newMemberId}`)
    .emit(SocketEvents.CONVERSATION_NEW, {
      conversation: await prisma.conversation.findUnique({
        where: { id: conversationId },
        select: conversationSelect,
      }),
    });
  await systemMessage(
    conversationId,
    actorId,
    `${names.get(actorId)} added ${names.get(newMemberId)}`,
  );
  return { added: true };
}

export async function removeGroupMember(
  actorId: string,
  conversationId: string,
  targetUsername: string,
) {
  await adminMembership(actorId, conversationId);
  const profile = await prisma.profile.findUnique({
    where: { username: targetUsername },
    select: { userId: true },
  });
  if (!profile) throw new NotFoundError("User");
  if (profile.userId === actorId)
    throw new BadRequestError("Use leave instead of removing yourself");

  const membership = await prisma.conversationParticipant.findUnique({
    where: {
      conversationId_userId: { conversationId, userId: profile.userId },
    },
    select: { id: true, leftAt: true },
  });
  if (!membership || membership.leftAt) throw new NotFoundError("Member");

  const names = await memberNames([actorId, profile.userId]);
  await prisma.conversationParticipant.update({
    where: { id: membership.id },
    data: { leftAt: new Date() },
  });

  // Evict their live sockets from the room — no lingering eavesdrop.
  getIO()
    .in(`user:${profile.userId}`)
    .socketsLeave(`conversation:${conversationId}`);
  await systemMessage(
    conversationId,
    actorId,
    `${names.get(actorId)} removed ${names.get(profile.userId)}`,
  );
  return { removed: true };
}

export async function leaveGroup(actorId: string, conversationId: string) {
  const membership = await prisma.conversationParticipant.findUnique({
    where: { conversationId_userId: { conversationId, userId: actorId } },
    select: {
      id: true,
      isAdmin: true,
      leftAt: true,
      conversation: { select: { type: true } },
    },
  });
  if (
    !membership ||
    membership.leftAt ||
    membership.conversation.type !== "GROUP"
  ) {
    throw new NotFoundError("Conversation");
  }

  const names = await memberNames([actorId]);
  await prisma.conversationParticipant.update({
    where: { id: membership.id },
    data: { leftAt: new Date() },
  });

  // Last admin leaving → promote the longest-standing member, or let the
  // group rest if empty. Orphaned groups (members, no admin) are the bug.
  if (membership.isAdmin) {
    const admins = await prisma.conversationParticipant.count({
      where: { conversationId, leftAt: null, isAdmin: true },
    });
    if (admins === 0) {
      const successor = await prisma.conversationParticipant.findFirst({
        where: { conversationId, leftAt: null },
        orderBy: { joinedAt: "asc" },
        select: { id: true },
      });
      if (successor) {
        await prisma.conversationParticipant.update({
          where: { id: successor.id },
          data: { isAdmin: true },
        });
      }
    }
  }

  getIO().in(`user:${actorId}`).socketsLeave(`conversation:${conversationId}`);
  await systemMessage(conversationId, actorId, `${names.get(actorId)} left`);
  return { left: true };
}

/** displayName lookup for system-message prose. */
async function memberNames(userIds: string[]): Promise<Map<string, string>> {
  const profiles = await prisma.profile.findMany({
    where: { userId: { in: userIds } },
    select: { userId: true, displayName: true },
  });
  return new Map(profiles.map((p) => [p.userId, p.displayName]));
}
