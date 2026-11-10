import { WebSocket } from 'ws';

import { isSessionExpired } from './auth.js';
import {
  deleteUserSession,
  getRegisteredGroup,
  getAgent,
  getJidsByFolder,
  getChannelMount,
  listQueuedFollowUps,
} from './db.js';
import { getGroupAllowedUserIds } from './group-broadcast-acl.js';
import type { FollowUpTransition, NewMessage, WsMessageOut } from './types.js';
import {
  isHostExecutionGroup,
  wsClients,
  getCachedSessionWithUser,
  invalidateSessionCache,
} from './web-context.js';
import {
  hasBoundWorkspaceReference,
  resolveBoundWorkspaceJid,
} from './workspace-attribution.js';

export function safeBroadcast(
  msg: WsMessageOut,
  adminOnly = false,
  allowedUserIds?: Set<string> | null,
): void {
  const data = JSON.stringify(msg);
  for (const [client, clientInfo] of wsClients) {
    if (client.readyState !== WebSocket.OPEN) {
      wsClients.delete(client);
      continue;
    }

    if (!clientInfo.sessionId) {
      wsClients.delete(client);
      try {
        client.close(1008, 'Unauthorized');
      } catch {
        /* ignore */
      }
      continue;
    }

    const session = getCachedSessionWithUser(clientInfo.sessionId);
    const expired = !!session && isSessionExpired(session.expires_at);
    const invalid = !session || expired || session.status !== 'active';
    if (invalid) {
      if (expired) {
        deleteUserSession(clientInfo.sessionId);
      }
      invalidateSessionCache(clientInfo.sessionId);
      wsClients.delete(client);
      try {
        client.close(1008, 'Unauthorized');
      } catch {
        /* ignore */
      }
      continue;
    }

    if (adminOnly && session.role !== 'admin') {
      continue;
    }

    // Group isolation: only the workspace owner can see this group's events.
    // allowedUserIds === null means ownership unresolvable → default-deny EVERYONE
    // (including admin). 故意这样：解析失败时宁可不广播也不要意外泄漏。
    if (allowedUserIds !== undefined) {
      if (allowedUserIds === null || !allowedUserIds.has(session.user_id)) {
        continue;
      }
    }

    try {
      client.send(data);
    } catch {
      wsClients.delete(client);
    }
  }
}

/** Check if a chatJid belongs to a host-mode group (for broadcast filtering) */
export function isHostGroupJid(chatJid: string): boolean {
  const group = getRegisteredGroup(chatJid);
  return !!group && isHostExecutionGroup(group);
}

/**
 * Normalize chatJid for WebSocket broadcasts.
 *
 * A bound IM chat resolves to the workspace it is actually bound to. The
 * folder scan below is only a fallback for unbound chats: an IM row keeps the
 * `folder`/`created_by` of the channel account owner even after it is bound
 * elsewhere, so scanning by folder would label another workspace's events with
 * the account owner's home JID and surface them in the wrong client.
 */
export function normalizeHomeJid(chatJid: string): string {
  if (chatJid.startsWith('web:')) return chatJid;
  const group = getRegisteredGroup(chatJid);
  if (!group) return chatJid;

  const attributionDeps = {
    getRegisteredGroup,
    getAgent,
    getJidsByFolder,
    getChannelMount,
  };
  const boundJid = resolveBoundWorkspaceJid(chatJid, attributionDeps);
  if (boundJid) return boundJid;
  if (hasBoundWorkspaceReference(chatJid, attributionDeps)) return chatJid;

  // Unbound IM chat: fall back to the web: JID sharing this folder (typically
  // the is_home group), which is where its messages are still attributed.
  const jids = getJidsByFolder(group.folder);
  for (const jid of jids) {
    if (jid.startsWith('web:')) {
      return jid;
    }
  }
  return chatJid;
}

export function broadcastToWebClients(chatJid: string, text: string): void {
  const timestamp = new Date().toISOString();
  const jid = normalizeHomeJid(chatJid);
  const allowedUserIds = getGroupAllowedUserIds(chatJid);
  safeBroadcast(
    { type: 'agent_reply', chatJid: jid, text, timestamp },
    isHostGroupJid(chatJid),
    allowedUserIds,
  );
}

export function broadcastNewMessage(
  chatJid: string,
  msg: NewMessage & { is_from_me?: boolean },
  agentId?: string,
  source?: string,
): void {
  // For virtual JIDs like "web:xxx#agent:yyy", extract base JID and agentId
  let baseChatJid = chatJid;
  let effectiveAgentId = agentId;
  if (chatJid.includes('#agent:')) {
    const parts = chatJid.split('#agent:');
    baseChatJid = parts[0];
    if (!effectiveAgentId) effectiveAgentId = parts[1];
  }
  const jid = normalizeHomeJid(baseChatJid);
  const allowedUserIds = getGroupAllowedUserIds(baseChatJid);
  const wsMsg: WsMessageOut = {
    type: 'new_message',
    chatJid: jid,
    message: { ...msg, is_from_me: msg.is_from_me ?? false },
    ...(effectiveAgentId ? { agentId: effectiveAgentId } : {}),
    ...(source ? { source } : {}),
  };
  safeBroadcast(wsMsg, isHostGroupJid(baseChatJid), allowedUserIds);
}

export function broadcastFollowUpUpdate(
  chatJid: string,
  transition?: FollowUpTransition,
): void {
  let baseChatJid = chatJid;
  let agentId: string | undefined;
  if (chatJid.includes('#agent:')) {
    const parts = chatJid.split('#agent:');
    baseChatJid = parts[0];
    agentId = parts[1];
  }
  const jid = normalizeHomeJid(baseChatJid);
  const allowedUserIds = getGroupAllowedUserIds(baseChatJid);
  const items = listQueuedFollowUps(chatJid);
  const msg: WsMessageOut = {
    type: 'follow_up_update',
    chatJid: jid,
    items,
    ...(agentId ? { agentId } : {}),
    ...(transition ? { transition } : {}),
  };
  safeBroadcast(msg, isHostGroupJid(baseChatJid), allowedUserIds);
}

export function broadcastTyping(chatJid: string, isTyping: boolean): void {
  const jid = normalizeHomeJid(chatJid);
  const allowedUserIds = getGroupAllowedUserIds(chatJid);
  safeBroadcast(
    { type: 'typing', chatJid: jid, isTyping },
    isHostGroupJid(chatJid),
    allowedUserIds,
  );
}
