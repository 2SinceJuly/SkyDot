import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, expect, it, vi } from 'vitest';

vi.mock('../src/middleware/auth.js', () => ({
  authMiddleware: async (_context: unknown, next: () => Promise<void>) =>
    next(),
  systemConfigMiddleware: async (
    _context: unknown,
    next: () => Promise<void>,
  ) => next(),
}));

const { default: routes } = await import('../src/routes/smart-home.js');
let temporaryDirectory: string;
const fetchHomeAssistant = vi.fn();

beforeEach(async () => {
  temporaryDirectory = await fs.mkdtemp(path.join(os.tmpdir(), 'skydot-home-'));
  const tokenFile = path.join(temporaryDirectory, 'token');
  await fs.writeFile(tokenFile, 'fixture-token\n', { mode: 0o600 });
  vi.stubEnv('SKYDOT_DEMO_OPEN', 'false');
  vi.stubEnv('SKYDOT_HOME_ASSISTANT_URL', 'http://127.0.0.1:8123/');
  vi.stubEnv(
    'SKYDOT_HOME_ASSISTANT_ENTITIES',
    'light.study,lock.door,scene.goodnight',
  );
  vi.stubEnv('SKYDOT_HOME_ASSISTANT_TOKEN_FILE', tokenFile);
  vi.stubGlobal('fetch', fetchHomeAssistant);
  fetchHomeAssistant.mockReset();
});

afterEach(async () => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  await fs.rm(temporaryDirectory, { recursive: true, force: true });
});

function command(entityId: string, action: string) {
  return routes.request('/commands', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ entityId, action }),
  });
}

it('shows only configured entities and omits upstream attributes', async () => {
  fetchHomeAssistant.mockResolvedValue(
    Response.json([
      {
        entity_id: 'light.study',
        state: 'off',
        attributes: { friendly_name: '书房灯', access_token: 'private' },
      },
      {
        entity_id: 'light.hidden',
        state: 'on',
        attributes: { friendly_name: '另一个房间' },
      },
    ]),
  );
  const response = await routes.request('/');
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({
    configured: true,
    entities: [
      {
        id: 'light.study',
        name: '书房灯',
        state: 'off',
        updatedAt: null,
        kind: 'switch',
      },
    ],
  });
});

it('allows explicit switch states and scene activation while denying unknown or unsafe targets', async () => {
  fetchHomeAssistant.mockImplementation(() =>
    Promise.resolve(Response.json([])),
  );
  expect((await command('light.hidden', 'turn_on')).status).toBe(404);
  expect((await command('lock.door', 'turn_on')).status).toBe(403);
  expect((await command('scene.goodnight', 'turn_off')).status).toBe(403);
  expect(fetchHomeAssistant).not.toHaveBeenCalled();

  expect((await command('light.study', 'turn_off')).status).toBe(200);
  expect(fetchHomeAssistant).toHaveBeenLastCalledWith(
    new URL('http://127.0.0.1:8123/api/services/light/turn_off'),
    expect.objectContaining({
      method: 'POST',
      body: '{"entity_id":"light.study"}',
      redirect: 'error',
    }),
  );
  expect((await command('scene.goodnight', 'turn_on')).status).toBe(200);
});

it('does not contact configured devices in demo mode', async () => {
  vi.stubEnv('SKYDOT_DEMO_OPEN', 'true');
  expect(await (await routes.request('/')).json()).toEqual({
    configured: false,
    entities: [],
  });
  expect((await command('light.study', 'turn_on')).status).toBe(404);
  expect(fetchHomeAssistant).not.toHaveBeenCalled();
});
