
 export const SocketEvents = {
  // ---- Server → client: facts ----
  MESSAGE_NEW: 'message:new',
  MESSAGE_EDITED: 'message:edited',
  MESSAGE_DELETED: 'message:deleted',
  CONVERSATION_NEW: 'conversation:new',
  CONVERSATION_READ: 'conversation:read',      // someone's lastReadAt moved
  TYPING_STARTED: 'typing:started',
  TYPING_STOPPED: 'typing:stopped',
  PRESENCE_CHANGED: 'presence:changed',        // { userId, online }

  CLIENT_TYPING_START: 'client:typing:start',  // { conversationId }
  CLIENT_TYPING_STOP: 'client:typing:stop',    // { conversationId }

  // ---- Server → client: call facts ----
  CALL_INCOMING: 'call:incoming',       
  CALL_ANSWERED: 'call:answered',        // { callId }
  CALL_DECLINED: 'call:declined',        // { callId }
  CALL_ENDED: 'call:ended',              // { callId, status }

  // ---- Peer ↔ peer via server relay: WebRTC plumbing ----
  CALL_SIGNAL: 'call:signal',            // { callId, data } — offer/answer/ICE, opaque to us

  // ---- Client → server: call requests ----
  CLIENT_CALL_SIGNAL: 'client:call:signal',   // { callId, data }

} as const;

export type SocketEventName = (typeof SocketEvents)[keyof typeof SocketEvents];