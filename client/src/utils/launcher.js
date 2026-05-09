const LAUNCHER_API = import.meta.env.VITE_LAUNCHER_API || 'http://127.0.0.1:3003';

export { LAUNCHER_API };

export async function launcherFetch(path, options = {}) {
  const { timeout, ...fetchOptions } = options;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout || 5000);
  try {
    const res = await fetch(`${LAUNCHER_API}${path}`, {
      ...fetchOptions,
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    return res;
  } catch (err) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') {
      throw new Error(`连接 Launcher 超时（${Math.round((timeout || 5000) / 1000)}秒），请确保 Launcher 已启动`);
    }
    if (err.name === 'TypeError' && err.message === 'Failed to fetch') {
      throw new Error('无法连接到 Launcher，请确保 Launcher 已启动');
    }
    throw err;
  }
}
