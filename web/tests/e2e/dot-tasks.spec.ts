import { randomUUID } from 'node:crypto';
import { expect, test } from '@playwright/test';
import { botHandoffHttpFixture } from '../../../tests/helpers/bot-handoff-http-fixture';
import type { ScheduledTask } from '../../src/stores/tasks';

test('each Dot manages its own scheduled tasks from its details', async ({
  page,
}, testInfo) => {
  test.setTimeout(60000);
  const fixture = await botHandoffHttpFixture();
  try {
    await fixture.json(
      await fixture.call('/api/config/system', 'PUT', {
        providerSetupSkipped: true,
      }),
    );
    const dot = await fixture.json<{
      profile: { id: string };
      jid: string;
      folder: string;
    }>(
      await fixture.call('/api/agent-profiles/quick-create', 'POST', {
        request_id: randomUUID(),
        name: '热点助手',
        avatar_shape: 'blob',
        avatar_color: '#1456f0',
      }),
    );
    await fixture.json(
      await fixture.call('/api/tasks', 'POST', {
        prompt: 'SkyDot 专属任务',
        schedule_type: 'cron',
        schedule_value: '0 8 * * *',
      }),
    );
    expect(
      (
        await page.request.post(`${fixture.origin}/api/auth/login`, {
          data: fixture.credentials,
        })
      ).status(),
    ).toBe(200);

    const chat = `${fixture.origin}/chat/${encodeURIComponent(dot.folder)}?bot=${dot.profile.id}`;
    const dotName = page
      .getByRole('heading', { name: '热点助手', exact: true })
      .getByRole('button');
    const taskName = '每日热点简报';
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(chat);
    await dotName.click();
    const details = page.getByRole('complementary', {
      name: '热点助手',
      exact: true,
    });
    await details.getByRole('tab', { name: '定时任务', exact: true }).click();
    const tasks = details.getByRole('tabpanel');
    await expect(tasks).toContainText('这个 Dot 还没有定时任务');
    await expect(tasks).not.toContainText('SkyDot 专属任务');

    await tasks.getByRole('button', { name: '创建任务', exact: true }).click();
    await tasks.getByRole('button', { name: '手动配置', exact: true }).click();
    await expect(tasks.getByText('所属工作区', { exact: true })).toHaveCount(0);
    await tasks.getByPlaceholder('输入任务的提示词...').fill(taskName);
    await tasks
      .getByPlaceholder('例如: 0 9 * * * (每天 9 点)')
      .fill('30 17 * * *');
    await tasks.getByRole('button', { name: '创建任务', exact: true }).click();
    await expect(tasks).toContainText(taskName);
    await expect(tasks).toContainText('每天 17:30');
    const result = await fixture.json<{ tasks: ScheduledTask[] }>(
      await fixture.call('/api/tasks'),
    );
    expect(
      result.tasks.find((task) => task.prompt === taskName)?.chat_jid,
    ).toBe(dot.jid);

    await tasks.getByRole('button', { name: '展开任务详情' }).click();
    await expect(tasks.getByText('执行日志', { exact: true })).toBeVisible();
    await details.getByRole('button', { name: '关闭上下文' }).click();
    await expect(dotName).toBeFocused();

    await page.goto(`${fixture.origin}/bots?view=team`);
    await page
      .getByRole('heading', { name: 'SkyDot', exact: true })
      .getByRole('button')
      .click();
    const coordinator = page.getByRole('complementary', {
      name: 'SkyDot',
      exact: true,
    });
    await coordinator
      .getByRole('tab', { name: '定时任务', exact: true })
      .click();
    await expect(coordinator.getByRole('tabpanel')).toContainText(
      'SkyDot 专属任务',
    );
    await expect(coordinator.getByRole('tabpanel')).not.toContainText(taskName);

    await page.setViewportSize({ width: 390, height: 844 });
    await page.addInitScript(() =>
      localStorage.setItem('skydot-theme', 'dark'),
    );
    await page.goto(chat);
    await dotName.click();
    const sheet = page.getByRole('dialog', { name: '热点助手', exact: true });
    await sheet.getByRole('tab', { name: '定时任务', exact: true }).click();
    const mobileTasks = sheet.getByRole('tabpanel');
    await expect(mobileTasks).toContainText(taskName);
    await expect(page.locator('html')).toHaveClass(/\bdark\b/);
    await page.screenshot({
      path: testInfo.outputPath('dot-tasks-phone-dark.png'),
    });
    page.once('dialog', (dialog) => dialog.accept());
    await mobileTasks.getByRole('button', { name: '暂停后续计划' }).click();
    await expect(mobileTasks).toContainText('已暂停');
    page.once('dialog', (dialog) => dialog.accept());
    await mobileTasks.getByRole('button', { name: '恢复后续计划' }).click();
    await expect(mobileTasks).toContainText('已启用');
    await mobileTasks.getByRole('button', { name: '将任务移到回收站' }).click();
    await page
      .getByRole('alertdialog')
      .getByRole('button', { name: '移到回收站', exact: true })
      .click();
    await expect(mobileTasks).not.toContainText(taskName);
    await mobileTasks
      .getByRole('button', { name: '回收站', exact: true })
      .click();
    await expect(mobileTasks).toContainText(taskName);
  } finally {
    await fixture.dispose();
  }
});
