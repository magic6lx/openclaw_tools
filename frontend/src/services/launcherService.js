const API_BASE = import.meta.env.VITE_API_BASE_URL || '';

export default {
  async getChangelog() {
    try {
      const response = await fetch(`${API_BASE}/api/launcher/changelog`);
      if (!response.ok) {
        return { success: false, error: 'Failed to fetch changelog' };
      }
      const data = await response.json();
      return data;
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  async getAllInteractionLogs(deviceId = null, limit = 500) {
    try {
      let url = `${API_BASE}/api/launcher-logs/all?limit=${limit}`;
      if (deviceId) {
        url += `&deviceId=${encodeURIComponent(deviceId)}`;
      }
      const response = await fetch(url);
      if (!response.ok) {
        return { success: false, error: 'Failed to fetch logs', logs: [] };
      }
      const data = await response.json();
      return {
        success: data.success || false,
        logs: data.logs || [],
        total: data.total || 0,
        error: data.message || null
      };
    } catch (error) {
      return { success: false, error: error.message, logs: [] };
    }
  }
};
