const API_BASE = import.meta.env.VITE_API_BASE || '';

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
  }
};
