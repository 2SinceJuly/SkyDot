import { defineConfig } from '@playwright/test';
import base from './playwright.group-create.config';
export default defineConfig({
  ...base,
  testMatch: 'member-stop.spec.ts',
  outputDir: '../.claude/skills/verify-skydot/artifacts/member-stop/browser',
});
