import { prisma } from '../../lib/prisma.js';
import { BadRequestError, ConflictError, NotFoundError } from '../../utils/errors.js';
import { memberConversation } from '../chat/chat.service.js';
import { getIO, isOnline } from '../../sockets/index.js';
import { SocketEvents } from '../../sockets/events.js';
import { logger } from '../../lib/logger.js';
import { env } from '../../config/env.js';
import { dispatch } from '../notifications/notifications.service.js';


const RING_TIMEOUT_MS = 45_000;

const callSelect = {
  id: true,
  conversationId: true,
  type: true,
  status: true,
  startedAt: true,
  answeredAt: true,
  endedAt: true,
  initiator: {
    select: {
      profile: { select: { username: true, displayName: true, avatarUrl: true, blobTint: true } },
    },
  },
  participants: {
    select: {
      userId: true,
      joinedAt: true,
      leftAt: true,
      user: { select: { profile: { select: { username: true, displayName: true } } } },
    },
  },
} as const;

/** Load a call the actor participates in, or 404. */
async function participantCall(actorId: string, callId: string) {
  const call = await prisma.call.findUnique({
    where: { id: callId },
    select: { id: true, conversationId: true, initiatorId: true, type: true, status: true },
  });
  if (!call) throw new NotFoundError('Call');
  const participant = await prisma.callParticipant.findUnique({
    where: { callId_userId: { callId, userId: actorId } },
    select: { id: true },
  });
  if (!participant) throw new NotFoundError('Call');
  return call;
}

export async function initiateCall(actorId: string, conversationId: string, type: 'VOICE' | 'VIDEO') {
  await memberConversation(actorId, conversationId);

  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    select: {
      type: true,
      participants: { where: { leftAt: null }, select: { userId: true } },
    },
  });
  if (!conversation) throw new NotFoundError('Conversation');
  // V1 scope: 1:1 calls only. Group calls are a schema-supported later.
  if (conversation.type !== 'DIRECT') {
    throw new BadRequestError('Calls are currently available in direct conversations only');
  }

  const calleeId = conversation.participants.find((p) => p.userId !== actorId)?.userId;
  if (!calleeId) throw new BadRequestError('No one to call');

  // Busy-check: one live call per conversation. RINGING or ONGOING = live.
  const liveCall = await prisma.call.findFirst({
    where: { conversationId, status: { in: ['RINGING', 'ONGOING'] } },
    select: { id: true },
  });
  if (liveCall) throw new ConflictError('A call is already in progress in this conversation');

  const call = await prisma.call.create({
    data: {
      conversationId,
      initiatorId: actorId,
      type,
      participants: { create: [{ userId: actorId }, { userId: calleeId }] },
    },
    select: callSelect,
  });

  // Ring the callee on their PERSONAL room — they may not have the
  // conversation open; an incoming call must reach every tab.
  getIO().to(`user:${calleeId}`).emit(SocketEvents.CALL_INCOMING, { call });

  // Ring timeout: unanswered after 45s → MISSED, both sides told.
  // In-memory timer — honest limitation: a server restart mid-ring
  // drops the timer, leaving a stale RINGING row. CA3's history query
  // treats over-age RINGING as MISSED defensively, so the record heals.
  setTimeout(() => {
    void (async () => {
      const fresh = await prisma.call.findUnique({ where: { id: call.id }, select: { status: true } });
      if (fresh?.status === 'RINGING') {
        await prisma.call.update({
          where: { id: call.id },
          data: { status: 'MISSED', endedAt: new Date() },
        });
        getIO().to(`conversation:${conversationId}`).emit(SocketEvents.CALL_ENDED, {
          callId: call.id,
          status: 'MISSED',
        });

        const callee = await prisma.callParticipant.findFirst({
          where: { callId: call.id, userId: { not: actorId } },
          select: { userId: true },
        });
        const caller = await prisma.profile.findUnique({
          where: { userId: actorId },
          select: { displayName: true },
        });
        if (callee) {
          void dispatch({
            recipientId: callee.userId,
            actorId,
            type: 'MISSED_CALL',
            title: `Missed ${type === 'VIDEO' ? 'video' : 'voice'} call from ${caller?.displayName ?? 'someone'}`,
            entityType: 'conversation',
            entityId: conversationId,
          });
        }
      }
    })().catch((err) => logger.error({ err, callId: call.id }, 'ring timeout handling failed'));
  }, RING_TIMEOUT_MS).unref();

  // Offline callee? Tell the caller honestly — the phone can't ring.
  return { call, calleeOnline: isOnline(calleeId) };
}

export async function answerCall(actorId: string, callId: string) {
  const call = await participantCall(actorId, callId);
  if (call.initiatorId === actorId) throw new BadRequestError('You cannot answer your own call');
  if (call.status !== 'RINGING') throw new ConflictError('This call is no longer ringing');

  const updated = await prisma.call.update({
    where: { id: callId },
    data: { status: 'ONGOING', answeredAt: new Date() },
    select: callSelect,
  });

  getIO().to(`conversation:${call.conversationId}`).emit(SocketEvents.CALL_ANSWERED, { callId });
  return updated;
}

export async function declineCall(actorId: string, callId: string) {
  const call = await participantCall(actorId, callId);
  if (call.initiatorId === actorId) throw new BadRequestError('Use end to cancel your own call');
  if (call.status !== 'RINGING') throw new ConflictError('This call is no longer ringing');

  await prisma.call.update({
    where: { id: callId },
    data: { status: 'DECLINED', endedAt: new Date() },
  });

  getIO().to(`conversation:${call.conversationId}`).emit(SocketEvents.CALL_DECLINED, { callId });
  return { declined: true };
}

export async function endCall(actorId: string, callId: string) {
  const call = await participantCall(actorId, callId);
  if (call.status !== 'RINGING' && call.status !== 'ONGOING') {
    throw new ConflictError('This call has already ended');
  }

  // Caller hanging up mid-ring = MISSED for the callee's history;
  // either side ending an ONGOING call = a normal ENDED.
  const finalStatus = call.status === 'RINGING' ? 'MISSED' : 'ENDED';

  await prisma.$transaction([
    prisma.call.update({
      where: { id: callId },
      data: { status: finalStatus, endedAt: new Date() },
    }),
    prisma.callParticipant.updateMany({
      where: { callId, leftAt: null },
      data: { leftAt: new Date() },
    }),
  ]);

  getIO().to(`conversation:${call.conversationId}`).emit(SocketEvents.CALL_ENDED, {
    callId,
    status: finalStatus,
  });

  if (finalStatus === 'MISSED') {
    const callee = await prisma.callParticipant.findFirst({
      where: { callId: call.id, userId: { not: call.initiatorId } },
      select: { userId: true },
    });
    const caller = await prisma.profile.findUnique({
      where: { userId: call.initiatorId },
      select: { displayName: true },
    });
    if (callee) {
      void dispatch({
        recipientId: callee.userId,
        actorId: call.initiatorId,
        type: 'MISSED_CALL',
        title: `Missed ${call.type === 'VIDEO' ? 'video' : 'voice'} call from ${caller?.displayName ?? 'someone'}`,
        entityType: 'conversation',
        entityId: call.conversationId,
      });
    }
  }

  return { ended: true, status: finalStatus };
}

/** Is this user a participant in this live call? The relay's gate. */
export async function canSignal(userId: string, callId: string): Promise<{ ok: boolean; conversationId?: string }> {
  const call = await prisma.call.findUnique({
    where: { id: callId },
    select: {
      conversationId: true,
      status: true,
      participants: { where: { userId }, select: { id: true } },
    },
  });
  if (!call || call.participants.length === 0) return { ok: false };
  if (call.status !== 'RINGING' && call.status !== 'ONGOING') return { ok: false };
  return { ok: true, conversationId: call.conversationId };
}

/**
 * Call history for a conversation, newest first.
 * Healing: a RINGING call older than the ring timeout is a stale row
 * (server restarted mid-ring, timer lost) — presented AND persisted
 * as MISSED on read. Self-repairing records over background sweepers.
 */
export async function callHistory(
  actorId: string,
  conversationId: string,
  opts: { cursor?: string; limit: number },
) {
  await memberConversation(actorId, conversationId);

  const rows = await prisma.call.findMany({
    where: { conversationId },
    orderBy: [{ startedAt: 'desc' }, { id: 'desc' }],
    take: opts.limit + 1,
    ...(opts.cursor ? { cursor: { id: opts.cursor }, skip: 1 } : {}),
    select: callSelect,
  });

  // Heal stale RINGING rows in this page.
  const staleCutoff = new Date(Date.now() - RING_TIMEOUT_MS - 5_000);
  const staleIds = rows
    .filter((c) => c.status === 'RINGING' && c.startedAt < staleCutoff)
    .map((c) => c.id);
  if (staleIds.length > 0) {
    await prisma.call.updateMany({
      where: { id: { in: staleIds }, status: 'RINGING' },
      data: { status: 'MISSED', endedAt: new Date() },
    });
  }
  const healed = rows.map((c) =>
    staleIds.includes(c.id) ? { ...c, status: 'MISSED' as const } : c,
  );

  const hasMore = healed.length > opts.limit;
  const page = hasMore ? healed.slice(0, opts.limit) : healed;
  return {
    page,
    meta: { cursor: hasMore ? (page[page.length - 1]?.id ?? null) : null, hasMore },
  };
}


/**
 * ICE server list for the client's RTCPeerConnection.
 * Always includes free STUN; adds Metered's TURN credentials when
 * configured. Metered's REST API mints short-lived credentials so our
 * secret never reaches the browser.
 */
export async function getIceServers() {
  const iceServers: unknown[] = [{ urls: 'stun:stun.l.google.com:19302' }];

  if (env.METERED_DOMAIN && env.METERED_SECRET) {
    try {
      const res = await fetch(
        `https://${env.METERED_DOMAIN}/api/v1/turn/credentials?apiKey=${env.METERED_SECRET}`,
      );
      if (res.ok) {
        const turnServers = (await res.json()) as unknown[];
        iceServers.push(...turnServers);
      } else {
        logger.warn({ status: res.status }, 'TURN credential fetch failed — STUN-only');
      }
    } catch (err) {
      logger.warn({ err }, 'TURN credential fetch failed — STUN-only');
    }
  }

  return { iceServers };
}