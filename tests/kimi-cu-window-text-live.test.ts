import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { expect, test } from 'vitest';
import { KimiCuBackend } from '../src/personal-agent/kimi-cu-backend.js';
import { openKimiCuMcp } from './helpers/kimicu-mcp.js';

// Real native text-only check against two windows created by this test. It
// never requests an image or inspects an existing user application.
test.skipIf(
  process.platform !== 'darwin' || process.env.SKYDOT_TEST_KIMICU_TEXT !== '1',
)(
  'selected synthetic window text excludes the other window',
  async () => {
    const root = fs.mkdtempSync(
      path.join(fs.realpathSync(os.tmpdir()), 'skydot-kimicu-text-'),
    );
    const app = path.join(root, 'Fixture.app/Contents');
    const binary = path.join(app, 'MacOS/Fixture');
    const ids = path.join(root, 'windows.json');
    let gui: ReturnType<typeof spawn> | undefined;
    let mcp: ReturnType<typeof openKimiCuMcp> | undefined;
    try {
      fs.mkdirSync(path.dirname(binary), { recursive: true, mode: 0o700 });
      fs.writeFileSync(
        path.join(app, 'Info.plist'),
        '<?xml version="1.0"?><plist version="1.0"><dict><key>CFBundleIdentifier</key><string>net.skydot.kimi-screenshot-fixture</string><key>CFBundleExecutable</key><string>Fixture</string><key>CFBundleName</key><string>Fixture</string><key>CFBundlePackageType</key><string>APPL</string></dict></plist>',
      );
      const build = spawnSync(
        '/usr/bin/swiftc',
        ['tests/fixtures/kimicu-screenshot-app/main.swift', '-o', binary],
        { timeout: 60000, stdio: 'ignore' },
      );
      expect(build.status).toBe(0);
      gui = spawn(binary, [], {
        env: {
          PATH: process.env.PATH,
          HOME: root,
          SKYDOT_COLOR_FIXTURE_OUTPUT: ids,
        },
        stdio: 'ignore',
      });
      for (let i = 0; i < 100 && !fs.existsSync(ids); i++)
        await new Promise((resolve) => setTimeout(resolve, 100));
      const target = JSON.parse(fs.readFileSync(ids, 'utf8')) as {
        pid: number;
        green: number;
        red: number;
      };
      expect(target.pid).toBe(gui.pid);
      mcp = openKimiCuMcp();
      expect(
        (
          await mcp.call('initialize', {
            protocolVersion: '2025-03-26',
            capabilities: {},
            clientInfo: { name: 'skydot-text-fixture', version: '1' },
          })
        ).error,
      ).toBeUndefined();
      mcp.notify('notifications/initialized');
      const native = {
        async callTool(name: string, args: Record<string, unknown>) {
          const value = await mcp!.call('tools/call', {
            name,
            arguments: args,
          });
          if (value.error) throw new Error('KimiCU call rejected');
          return value.result;
        },
      };
      const observe = (windowId: number) =>
        new KimiCuBackend(native, {
          appId: 'net.skydot.kimi-screenshot-fixture',
          pid: target.pid,
          windowId,
        }).observe();
      const green = await observe(target.green);
      const red = await observe(target.red);
      expect(green.text).toContain('SkyDot Green Fixture');
      expect(green.text).not.toContain('SkyDot Red Fixture');
      expect(red.text).toContain('SkyDot Red Fixture');
      expect(red.text).not.toContain('SkyDot Green Fixture');
      // Re-observe the green window immediately before using its native index;
      // observing the red window supersedes the earlier native snapshot.
      const adapter = new KimiCuBackend(native, {
        appId: 'net.skydot.kimi-screenshot-fixture',
        pid: target.pid,
        windowId: target.green,
      });
      const before = await adapter.observe();
      const index = /\[(\d+)\] AXButton [^\n]*Run synthetic action/.exec(
        before.text,
      )?.[1];
      expect(index).toBeDefined();
      await adapter.executeAtTarget({
        target: before.target,
        action: { action: 'click', index: Number(index) },
      });
      const after = await adapter.observe();
      expect(after.text).toContain('Synthetic action complete');
      expect(after.text).not.toContain('SkyDot Red Fixture');
    } finally {
      mcp?.close();
      gui?.kill('SIGTERM');
      fs.rmSync(root, { recursive: true, force: true });
    }
  },
  90000,
);
