
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

  // ---- Client → server: requests ----
  CLIENT_TYPING_START: 'client:typing:start',  // { conversationId }
  CLIENT_TYPING_STOP: 'client:typing:stop',    // { conversationId }
} as const;

export type SocketEventName = (typeof SocketEvents)[keyof typeof SocketEvents];