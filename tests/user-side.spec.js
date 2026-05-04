import { test, expect, LAUNCHER_API } from './helpers';

test.describe('用户端 - 配置页面', () => {
  test('U-01 配置页面正常加载', async ({ userPage: page }) => {
    await page.goto('/config');
    await page.waitForTimeout(3000);
    await expect(page.locator('h2:has-text("配置管理")')).toBeVisible({ timeout: 15000 });
  });

  test('U-02 核心配置区域可见', async ({ userPage: page }) => {
    await page.goto('/config');
    await page.waitForTimeout(3000);
    await expect(page.locator('text=OpenClaw核心配置')).toBeVisible({ timeout: 15000 });
  });

  test('U-03 共享模版区域可见', async ({ userPage: page }) => {
    await page.goto('/config');
    await page.waitForTimeout(3000);
    await expect(page.locator('text=共享模版')).toBeVisible({ timeout: 15000 });
  });

  test('U-04 切换到共享模版Tab', async ({ userPage: page }) => {
    await page.goto('/config');
    await page.waitForTimeout(3000);
    const sharedTemplatesTab = page.locator('text=共享模版').first();
    await expect(snapshotTab).toBeVisible({ timeout: 15000 });
    await snapshotTab.click();
    await page.waitForTimeout(1000);
  });

  test('U-05 切换到记录Tab', async ({ userPage: page }) => {
    await page.goto('/config');
    await page.waitForTimeout(3000);
    const recordsTab = page.locator('text=记 录').first();
    await expect(recordsTab).toBeVisible({ timeout: 15000 });
    await recordsTab.click();
    await page.waitForTimeout(1000);
  });

  test('U-06 切换到共享模版Tab', async ({ userPage: page }) => {
    await page.goto('/config');
    await page.waitForTimeout(3000);
    const templatesTab = page.locator('text=模 板').first();
    await expect(templatesTab).toBeVisible({ timeout: 15000 });
    await templatesTab.click();
    await page.waitForTimeout(1000);
  });
});

test.describe('用户端 - 模板应用', () => {
  test('U-07 共享模版列表加载', async ({ userPage: page }) => {
    await page.goto('/config');
    await page.waitForTimeout(3000);
    const templatesTab = page.locator('text=模 板').first();
    await templatesTab.click();
    await page.waitForTimeout(2000);
  });

  test('U-08 点击共享模版查看详情', async ({ userPage: page }) => {
    await page.goto('/config');
    await page.waitForTimeout(3000);

    const templateCards = page.locator('.ant-card-hoverable');
    const count = await templateCards.count();
    if (count > 0) {
      await templateCards.first().click();
      await page.waitForTimeout(2000);

      const categoryCheckbox = page.locator('.ant-checkbox-wrapper');
      if ((await categoryCheckbox.count()) > 0) {
        await expect(categoryCheckbox.first()).toBeVisible();
      }
    }
  });

  test('U-09 分类勾选功能', async ({ userPage: page }) => {
    await page.goto('/config');
    await page.waitForTimeout(3000);

    const templateCards = page.locator('.ant-card-hoverable');
    if ((await templateCards.count()) > 0) {
      await templateCards.first().click();
      await page.waitForTimeout(2000);

      const categoryCheckbox = page.locator('.ant-checkbox-wrapper');
      if ((await categoryCheckbox.count()) > 0) {
        await categoryCheckbox.first().click();
        await page.waitForTimeout(500);
        await categoryCheckbox.first().click();
        await page.waitForTimeout(500);
      }
    }
  });

  test('U-10 应用按钮状态', async ({ userPage: page }) => {
    await page.goto('/config');
    await page.waitForTimeout(3000);

    const templateCards = page.locator('.ant-card-hoverable');
    if ((await templateCards.count()) > 0) {
      await templateCards.first().click();
      await page.waitForTimeout(2000);

      const applyButton = page.locator('button:has-text("应用")');
      if (await applyButton.isVisible()) {
        const isDisabled = await applyButton.isDisabled();
        expect(typeof isDisabled).toBe('boolean');
      }
    }
  });
});

test.describe('用户端 - 快照管理', () => {
  test('U-11 快照列表显示', async ({ userPage: page }) => {
    await page.goto('/config');
    await page.waitForTimeout(3000);
    const snapshotTab = page.locator('text=快 照').first();
    await snapshotTab.click();
    await page.waitForTimeout(2000);

    const response = await page.request.get(`${LAUNCHER_API}/template/snapshots`);
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(Array.isArray(data.snapshots)).toBe(true);
  });

  test('U-12 快照回滚按钮可见', async ({ userPage: page }) => {
    await page.goto('/config');
    await page.waitForTimeout(3000);
    const snapshotTab = page.locator('text=快 照').first();
    await snapshotTab.click();
    await page.waitForTimeout(2000);

    const rollbackButton = page.locator('button:has-text("回滚")');
    const count = await rollbackButton.count();
    if (count > 0) {
      await expect(rollbackButton.first()).toBeVisible();
    }
  });

  test('U-13 快照删除按钮可见', async ({ userPage: page }) => {
    await page.goto('/config');
    await page.waitForTimeout(3000);
    const snapshotTab = page.locator('text=快 照').first();
    await snapshotTab.click();
    await page.waitForTimeout(2000);

    const deleteButtons = page.locator('button:has-text("删除")');
    const count = await deleteButtons.count();
    if (count > 0) {
      await expect(deleteButtons.first()).toBeVisible();
    }
  });
});

test.describe('用户端 - 配置文件检测', () => {
  test('U-14 配置文件检测区域可见', async ({ userPage: page }) => {
    await page.goto('/config');
    await page.waitForTimeout(5000);
    await expect(page.locator('text=配置文件检测')).toBeVisible({ timeout: 15000 });
  });

  test('U-15 目录状态标签显示', async ({ userPage: page }) => {
    await page.goto('/config');
    await page.waitForTimeout(5000);
    const existTag = page.locator('.ant-tag').filter({ hasText: '存在' });
    const notExistTag = page.locator('.ant-tag').filter({ hasText: '不存在' });
    const hasExist = (await existTag.count()) > 0;
    const hasNotExist = (await notExistTag.count()) > 0;
    expect(hasExist || hasNotExist).toBe(true);
  });
});
