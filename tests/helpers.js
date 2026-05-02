import { test as base, expect } from '@playwright/test';

const LAUNCHER_API = 'http://127.0.0.1:3003';
const SERVER_API = 'http://127.0.0.1:3002';
const TEST_USER_CODE = 'LO93Z37JY19Q';
const TEST_ADMIN_CODE = 'ADMIN12345678';

let _userToken = null;
let _adminToken = null;

async function getToken(request, code) {
  const res = await request.post(`${SERVER_API}/api/auth/login`, {
    data: { code }
  });
  if (res.status() !== 200) {
    console.error('Login failed with status:', res.status());
    return null;
  }
  const data = await res.json();
  return data.success ? data.token : null;
}

const test = base.extend({
  userPage: async ({ page, request }, use) => {
    if (!_userToken) {
      _userToken = await getToken(request, TEST_USER_CODE);
    }
    if (_userToken) {
      await page.goto('/');
      await page.evaluate((t) => {
        localStorage.setItem('token', t);
      }, _userToken);
      await page.reload();
      await page.waitForTimeout(2000);
    }
    await use(page);
  },

  adminPage: async ({ page, request }, use) => {
    if (!_adminToken) {
      _adminToken = await getToken(request, TEST_ADMIN_CODE);
    }
    if (_adminToken) {
      await page.goto('/');
      await page.evaluate((t) => {
        localStorage.setItem('token', t);
      }, _adminToken);
      await page.reload();
      await page.waitForTimeout(2000);
    }
    await use(page);
  }
});

export { test, expect, LAUNCHER_API, SERVER_API };
