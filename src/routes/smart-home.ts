import fs from 'node:fs/promises';

import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { z } from 'zod';

import { isDemoOpenEnabled } from '../demo-open.js';
import { authMiddleware, systemConfigMiddleware } from '../middleware/auth.js';
import type { Variables } from '../web-context.js';

const ENTITY_ID = /^[a-z][a-z0-9_]*\.[a-z0-9_]+$/;
const SWITCH_DOMAINS = new Set(['light', 'fan', 'switch', 'input_boolean']);
const State = z.object({
  entity_id: z.string(),
  state: z.string(),
  last_changed: z.string().optional(),
  attributes: z.object({ friendly_name: z.string().optional() }),
});
const Command = z
  .object({
    entityId: z.string().regex(ENTITY_ID).max(150),
    action: z.enum(['turn_on', 'turn_off']),
  })
  .strict();

function configuration() {
  if (isDemoOpenEnabled()) return null;
  const address = process.env.SKYDOT_HOME_ASSISTANT_URL?.trim();
  const tokenFile = process.env.SKYDOT_HOME_ASSISTANT_TOKEN_FILE?.trim();
  if (!address || !tokenFile) return null;
  const endpoint = URL.parse(address);
  if (
    !endpoint ||
    !['http:', 'https:'].includes(endpoint.protocol) ||
    endpoint.username ||
    endpoint.password ||
    endpoint.search ||
    endpoint.hash
  ) {
    throw new Error('Invalid Home Assistant URL');
  }
  if (!endpoint.pathname.endsWith('/')) endpoint.pathname += '/';
  const entityIds = new Set(
    (process.env.SKYDOT_HOME_ASSISTANT_ENTITIES ?? '')
      .split(',')
      .map((value) => value.trim())
      .filter((value) => ENTITY_ID.test(value))
      .slice(0, 100),
  );
  return { endpoint, tokenFile, entityIds };
}

type HomeAssistantConfig = NonNullable<ReturnType<typeof configuration>>;

async function callHomeAssistant(
  config: HomeAssistantConfig,
  path: string,
  body?: { entity_id: string },
): Promise<Response> {
  const token = (await fs.readFile(config.tokenFile, 'utf8')).trim();
  if (!token) throw new Error('Missing Home Assistant token');
  const response = await fetch(new URL(path, config.endpoint), {
    method: body ? 'POST' : 'GET',
    headers: {
      Authorization: 'Bearer ' + token,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    redirect: 'error',
    signal: AbortSignal.timeout(4500),
  });
  if (!response.ok) throw new Error('Home Assistant rejected the request');
  return response;
}

const routes = new Hono<{ Variables: Variables }>();
routes.use('*', authMiddleware, systemConfigMiddleware);

routes.get('/', async (c) => {
  c.header('Cache-Control', 'no-store');
  try {
    const config = configuration();
    if (!config) return c.json({ configured: false, entities: [] });
    const response = await callHomeAssistant(config, 'api/states');
    const states: unknown = await response.json();
    if (!Array.isArray(states)) throw new Error('Unexpected states');
    const entities = states.flatMap((value: unknown) => {
      const state = State.safeParse(value);
      if (!state.success || !config.entityIds.has(state.data.entity_id))
        return [];
      const entity = state.data;
      const domain = entity.entity_id.split('.')[0];
      return [
        {
          id: entity.entity_id,
          name: entity.attributes.friendly_name || entity.entity_id,
          state: entity.state,
          updatedAt: entity.last_changed ?? null,
          kind: SWITCH_DOMAINS.has(domain)
            ? 'switch'
            : domain === 'scene'
              ? 'scene'
              : 'read-only',
        },
      ];
    });
    return c.json({ configured: true, entities });
  } catch {
    return c.json(
      { error: '无法读取 Home Assistant，请检查连接和令牌配置。' },
      502,
    );
  }
});

routes.post('/commands', bodyLimit({ maxSize: 1024 }), async (c) => {
  if (
    !/^application\/json(?:\s*;|$)/i.test(c.req.header('Content-Type') ?? '')
  ) {
    return c.json({ error: '请求必须使用 JSON。' }, 415);
  }
  const command = Command.safeParse(await c.req.json().catch(() => null));
  if (!command.success) return c.json({ error: '设备操作无效。' }, 400);
  const { entityId, action } = command.data;
  try {
    const config = configuration();
    if (!config || !config.entityIds.has(entityId)) {
      return c.json({ error: '找不到已授权的设备。' }, 404);
    }
    const domain = entityId.split('.')[0];
    if (
      !SWITCH_DOMAINS.has(domain) &&
      !(domain === 'scene' && action === 'turn_on')
    ) {
      return c.json({ error: '此设备仅供查看。' }, 403);
    }
    const response = await callHomeAssistant(
      config,
      `api/services/${domain}/${action}`,
      { entity_id: entityId },
    );
    // HA returns all states that changed; the client refreshes only its allowed entities.
    await response.body?.cancel();
    return c.json({ accepted: true });
  } catch {
    return c.json(
      { error: '设备操作结果未知，请先刷新状态再决定是否重试。' },
      502,
    );
  }
});

export default routes;
