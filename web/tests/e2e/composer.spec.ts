import { expect, test, type Page } from '@playwright/test';

async function openComposer(page: Page) {
  await page.route(
    (url) => url.pathname.startsWith('/api/'),
    (route) => route.fulfill({ json: { options: ['local-pi'] } }),
  );
  await page.goto('/tests/e2e/mobile-chat-harness.html');
  return page.getByPlaceholder('输入消息...');
}

for (const viewport of [
  { width: 1440, height: 900 },
  { width: 390, height: 844 },
]) {
  for (const dark of [false, true]) {
    test(`composer focus and geometry ${viewport.width} ${dark ? 'dark' : 'light'}`, async ({
      page,
    }) => {
      await page.setViewportSize(viewport);
      const input = await openComposer(page);
      await page.evaluate(
        (enabled) => document.documentElement.classList.toggle('dark', enabled),
        dark,
      );
      const surface = page.locator('[data-input-surface]');
      await input.focus();
      await expect(input).toHaveCSS('outline-style', 'none');
      await expect(surface).not.toHaveCSS('box-shadow', 'none');
      await expect(
        page.getByRole('button', { name: '发送消息', exact: true }),
      ).toBeDisabled();
      await input.fill(
        Array.from({ length: 30 }, (_, i) => `第 ${i} 行长文本`).join('\n'),
      );
      const geometry = await input.evaluate((element) => {
        const input = element as HTMLTextAreaElement;
        const surface = input.closest('[data-input-surface]')!;
        const box = surface.getBoundingClientRect();
        const button = surface
          .querySelector('button[aria-label="发送消息"]')!
          .getBoundingClientRect();
        return {
          height: input.clientHeight,
          scroll: input.scrollHeight,
          inputBottom: input.getBoundingClientRect().bottom,
          buttonTop: button.top,
          buttonWidth: button.width,
          left: box.left,
          right: box.right,
          bottom: box.bottom,
          viewportWidth: innerWidth,
          viewportHeight: innerHeight,
          pageWidth: document.documentElement.scrollWidth,
        };
      });
      expect(geometry.height).toBeLessThanOrEqual(144);
      expect(geometry.scroll).toBeGreaterThan(geometry.height);
      expect(geometry.inputBottom).toBeLessThanOrEqual(geometry.buttonTop);
      expect(geometry.buttonWidth).toBeGreaterThanOrEqual(44);
      expect(geometry.left).toBeGreaterThanOrEqual(0);
      expect(geometry.right).toBeLessThanOrEqual(geometry.viewportWidth);
      expect(geometry.viewportHeight - geometry.bottom).toBeLessThanOrEqual(16);
      expect(geometry.pageWidth).toBeLessThanOrEqual(geometry.viewportWidth);
      await input.fill('');
      await page.getByRole('button', { name: '添加文件', exact: true }).click();
      await page.keyboard.press('Tab');
      await expect(
        page.getByRole('button', { name: '清除当前会话上下文' }),
      ).toBeFocused();
      await expect(
        page.getByRole('button', { name: '清除当前会话上下文' }),
      ).toHaveCSS('outline-style', 'solid');
    });
  }
}

test('draft, IME, attachments and failed send survive the unified panel', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const input = await openComposer(page);
  await input.fill('保留的草稿');
  await expect
    .poll(() =>
      page.evaluate(async () => {
        const modulePath = '/src/stores/chat.ts';
        const { useChatStore } = await import(modulePath);
        return useChatStore.getState().drafts['web:e2e-mobile'];
      }),
    )
    .toBe('保留的草稿');
  let requests = 0;
  await page.route('**/api/messages', (route) => {
    requests++;
    return route.fulfill({ status: 500, json: { error: 'test failure' } });
  });
  await input.dispatchEvent('compositionstart');
  await input.dispatchEvent('keydown', { key: 'Enter', isComposing: true });
  expect(requests).toBe(0);
  await input.dispatchEvent('compositionend');
  await input.press('Shift+Enter');
  await expect(input).toHaveValue('保留的草稿\n');
  await page.locator('input[type=file][accept="image/*"]').setInputFiles({
    name: 'pixel.png',
    mimeType: 'image/png',
    buffer: Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aWQAAAABJRU5ErkJggg==',
      'base64',
    ),
  });
  await expect(page.getByText('已添加 1 张图片')).toBeVisible();
  await page.getByRole('button', { name: '发送消息', exact: true }).click();
  await expect(page.getByText('发送失败，输入已保留，请重试')).toBeVisible();
  await expect(input).toHaveValue('保留的草稿\n');
  await expect(page.getByText('已添加 1 张图片')).toBeVisible();
  expect(requests).toBe(1);
});

test('successful send clears input and running state exposes stop', async ({
  page,
}) => {
  const input = await openComposer(page);
  await input.fill('发送测试');
  await page.route('**/api/messages', (route) =>
    route.fulfill({
      json: {
        success: true,
        messageId: 'sent-1',
        timestamp: new Date().toISOString(),
        disposition: 'started',
      },
    }),
  );
  await page.getByRole('button', { name: '发送消息', exact: true }).click();
  await expect(input).toHaveValue('');
  await page.evaluate(async () => {
    const modulePath = '/src/stores/chat.ts';
    const { useChatStore } = await import(modulePath);
    useChatStore.setState({ waiting: { 'web:e2e-mobile': true } });
  });
  const stop = page.getByRole('button', { name: '停止当前运行', exact: true });
  await expect(stop).toBeVisible();
  await page.route('**/interrupt', (route) =>
    route.fulfill({ json: { success: true, interrupted: true } }),
  );
  const request = page.waitForRequest('**/interrupt');
  await stop.click();
  await request;
});

test('pasted and dropped images remain removable on touch', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const input = await openComposer(page);
  await input.evaluate((element) => {
    const clipboardData = new DataTransfer();
    clipboardData.items.add(
      new File([new Uint8Array([137, 80, 78, 71])], 'pasted.png', {
        type: 'image/png',
      }),
    );
    element.dispatchEvent(
      new ClipboardEvent('paste', {
        clipboardData,
        bubbles: true,
        cancelable: true,
      }),
    );
  });
  await expect(page.getByText('已添加 1 张图片')).toBeVisible();
  await page.locator('[data-message-input]').evaluate((element) => {
    const dataTransfer = new DataTransfer();
    dataTransfer.items.add(
      new File([new Uint8Array([137, 80, 78, 71])], 'dropped.png', {
        type: 'image/png',
      }),
    );
    element.dispatchEvent(
      new DragEvent('drop', { dataTransfer, bubbles: true, cancelable: true }),
    );
  });
  await expect(page.getByText('已添加 2 张图片')).toBeVisible();
  await page
    .getByRole('button', { name: '移除图片', exact: true })
    .first()
    .click();
  await expect(page.getByText('已添加 1 张图片')).toBeVisible();
  await page.getByRole('button', { name: '移除图片', exact: true }).click();
  await expect(page.getByText('已添加 1 张图片')).not.toBeVisible();
});
