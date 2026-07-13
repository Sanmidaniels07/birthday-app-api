import { registerEndpoint } from '../../docs/openapi.js';
import { initiateCallSchema } from './calls.schemas.js';

registerEndpoint({
  method: 'post', path: '/calls', tag: 'Calls',
  summary: 'Start a voice/video call in a DM (rings the callee; 45s timeout → MISSED)',
  secured: true,
  body: initiateCallSchema,
  responses: {
    '201': { description: 'The call, plus calleeOnline' },
    '400': { description: 'Not a DM' },
    '404': { description: 'Not your conversation' },
    '409': { description: 'A call is already live here' },
  },
});
registerEndpoint({
  method: 'post', path: '/calls/{callId}/answer', tag: 'Calls',
  summary: 'Answer a ringing call (callee only)', secured: true,
  responses: { '200': { description: 'ONGOING' }, '400': { description: 'Own call' }, '409': { description: 'No longer ringing' } },
});
registerEndpoint({
  method: 'post', path: '/calls/{callId}/decline', tag: 'Calls',
  summary: 'Decline a ringing call (callee only)', secured: true,
  responses: { '200': { description: 'DECLINED' }, '409': { description: 'No longer ringing' } },
});
registerEndpoint({
  method: 'post', path: '/calls/{callId}/end', tag: 'Calls',
  summary: 'End a call (mid-ring by the caller → MISSED; ongoing → ENDED)', secured: true,
  responses: { '200': { description: 'Final status' }, '409': { description: 'Already ended' } },
});
registerEndpoint({
  method: 'get', path: '/calls/history', tag: 'Calls',
  summary: 'Call history for a conversation (?conversationId=; stale rings self-heal to MISSED)',
  secured: true,
  responses: { '200': { description: 'Call records, newest first' }, '404': { description: 'Not your conversation' } },
});
registerEndpoint({
  method: 'get', path: '/calls/ice-servers', tag: 'Calls',
  summary: 'ICE servers for RTCPeerConnection (STUN always; TURN when configured)', secured: true,
  responses: { '200': { description: 'The iceServers array' } },
});