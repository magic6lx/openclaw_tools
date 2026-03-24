import api from './api';

const invitationCodeService = {
  async getAllCodes(status = 'all') {
    try {
      const params = status !== 'all' ? { status } : {};
      return await api.get('/invitation-codes', { params });
    } catch (error) {
      console.error('获取邀请码列表失败:', error);
      throw error;
    }
  },

  async getCodeByCode(code) {
    try {
      return await api.get(`/invitation-codes/code/${code}`);
    } catch (error) {
      console.error('获取邀请码详情失败:', error);
      throw error;
    }
  },

  async createCode(data) {
    try {
      return await api.post('/invitation-codes', data);
    } catch (error) {
      console.error('创建邀请码失败:', error);
      throw error;
    }
  },

  async activateCode(code) {
    try {
      return await api.post(`/invitation-codes/activate/${code}`);
    } catch (error) {
      console.error('激活邀请码失败:', error);
      throw error;
    }
  },

  async getConfigByCode(code) {
    try {
      return await api.get(`/invitation-codes/${code}/config`);
    } catch (error) {
      console.error('获取配置失败:', error);
      throw error;
    }
  },

  async deleteCode(id) {
    try {
      return await api.delete(`/invitation-codes/${id}`);
    } catch (error) {
      console.error('删除邀请码失败:', error);
      throw error;
    }
  },
};

export default invitationCodeService;