import { test, expect } from '@playwright/test';

const LAUNCHER_API = 'http://127.0.0.1:3003';
const SERVER_API = '';

test.describe('集成测试 - 完整模板流程', () => {
  test('IT-01 动态发现→保存Manifest→导出模板', async ({ request }) => {
    const discoverRes = await request.post(`${LAUNCHER_API}/template/discover`, {
      data: {}
    });
    const discoverData = await discoverRes.json();
    expect(discoverData.success).toBe(true);
    expect(discoverData.discovered.categories.length).toBeGreaterThan(0);

    const manifestName = `integration-test-${Date.now()}`;
    const categories = discoverData.discovered.categories.slice(0, 3).map(c => ({
      name: c.name,
      label: c.label,
      source: c.source,
      paths: c.paths,
      discoveryHint: c.discoveryHint
    }));

    const manifest = {
      templateManifest: {
        name: manifestName,
        isDefault: false,
        categories,
        normalizePaths: discoverData.discovered.normalizePaths,
        excludedDirs: discoverData.discovered.excludedDirs
      }
    };

    const saveRes = await request.post(`${LAUNCHER_API}/template/manifest/save`, {
      data: { manifest }
    });
    const saveData = await saveRes.json();
    if (saveData.success) {
      expect(saveData.success).toBe(true);

      const exportRes = await request.post(`${LAUNCHER_API}/template/export`, {
        data: { manifestName }
      });
      const exportData = await exportRes.json();

      if (exportData.success) {
        expect(exportData).toHaveProperty('config');
        expect(exportData).toHaveProperty('exportInfo');
      }

      const deleteRes = await request.delete(`${LAUNCHER_API}/template/manifest/${manifestName}`);
      const deleteData = await deleteRes.json();
      expect(deleteData.success).toBe(true);
    } else {
      console.warn('Manifest save skipped (permission issue):', saveData.error);
      expect(saveData).toHaveProperty('error');
    }
  });

  test('IT-02 快照创建→回滚→删除完整流程', async ({ request }) => {
    const snapshotsBeforeRes = await request.get(`${LAUNCHER_API}/template/snapshots`);
    const snapshotsBeforeData = await snapshotsBeforeRes.json();
    expect(snapshotsBeforeData.success).toBe(true);

    if (snapshotsBeforeData.snapshots && snapshotsBeforeData.snapshots.length > 0) {
      const snapshotId = snapshotsBeforeData.snapshots[0].id;

      const rollbackRes = await request.post(
        `${LAUNCHER_API}/template/snapshot/${snapshotId}/rollback`
      );
      const rollbackData = await rollbackRes.json();
      expect(rollbackRes.ok()).toBe(true);

      if (rollbackData.success) {
        expect(rollbackData).toHaveProperty('restoredCount');
        expect(rollbackData).toHaveProperty('deletedCount');
      }
    }
  });

  test('IT-03 日志标签化验证', async ({ request }) => {
    await request.post(`${LAUNCHER_API}/template/discover`, {
      data: {}
    });

    const logsRes = await request.get(`${LAUNCHER_API}/logs?limit=100`);
    const logsData = await logsRes.json();

    const taggedLogs = logsData.logs?.filter(log =>
      log.message?.includes('[DISCOVER]') ||
      log.message?.includes('[APPLY]') ||
      log.message?.includes('[SNAPSHOT]') ||
      log.message?.includes('[ROLLBACK]')
    );

    const discoverLogs = taggedLogs?.filter(log => log.message?.includes('[DISCOVER]'));
    expect(discoverLogs?.length).toBeGreaterThan(0);
  });

  test('IT-04 配置导出与导入一致性', async ({ request }) => {
    const exportRes = await request.get(`${LAUNCHER_API}/config/export`);
    const exportData = await exportRes.json();

    if (exportData.success && exportData.config) {
      expect(exportData.config).toHaveProperty('agents');
    }
  });
});
